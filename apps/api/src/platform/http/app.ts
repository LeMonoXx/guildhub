import {
  structuredLogger,
  type StructuredLoggerEnv,
} from "@hono/structured-logger";
import { httpInstrumentationMiddleware } from "@hono/otel";
import { Hono } from "hono";
import { requestId, type RequestIdVariables } from "hono/request-id";
import { routePath } from "hono/route";
import type { Logger } from "pino";
import {
  migrationsAreApplied,
  pingDatabase,
  type Database,
} from "../db/client.js";
import { hasCommittedMigrations } from "../db/migrations-folder.js";
import { internalError, notFoundError, problemResponse } from "./problems.js";

export type AppEnv = StructuredLoggerEnv<Logger> & {
  Variables: RequestIdVariables;
};

export interface AppConfig {
  readonly logger: Logger;
  readonly serviceName: string;
  readonly database?: Database;
}

export function createApp(config: AppConfig): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use(
    "*",
    httpInstrumentationMiddleware({
      serviceName: config.serviceName,
      getUrlFull: (context) => new URL(context.req.url).origin,
    }),
  );
  app.use("*", requestId({ limitLength: 128 }));
  app.use(
    "*",
    structuredLogger<AppEnv, Logger>({
      createLogger: (context) =>
        config.logger.child({
          module: "http",
          requestId: context.var.requestId,
        }),
      onResponse: (logger, context, durationMs) => {
        const route = routePath(context);
        const fields = {
          method: context.req.method,
          route,
          status: context.res.status,
          durationMs,
        };
        if (context.res.status >= 500) {
          logger.error(fields, "request completed");
          return;
        }
        if (route.startsWith("/health")) {
          logger.debug(fields, "health request completed");
          return;
        }
        logger.info(fields, "request completed");
      },
      onError: (logger, error, context, durationMs) => {
        const route = routePath(context);
        logger.error(
          {
            err: error,
            method: context.req.method,
            route,
            status: context.res.status,
            durationMs,
          },
          "request failed",
        );
      },
    }),
  );

  app.get("/health/live", (context) => context.json({ status: "ok" }));
  app.get("/health", (context) => context.json({ status: "ok" }));
  app.get("/health/ready", async (context) => {
    if (config.database === undefined) {
      return context.json({ status: "not_ready" }, 503);
    }
    try {
      await pingDatabase(config.database);
      if (
        hasCommittedMigrations() &&
        !(await migrationsAreApplied(config.database))
      ) {
        return context.json({ status: "not_ready" }, 503);
      }
      return context.json({ status: "ok" });
    } catch (error) {
      config.logger.warn({ module: "health", err: error }, "readiness failed");
      return context.json({ status: "not_ready" }, 503);
    }
  });

  app.notFound((context) => problemResponse(context, notFoundError()));
  app.onError((error, context) => {
    config.logger.error({ module: "http", err: error }, "unhandled error");
    return problemResponse(context, internalError());
  });

  return app;
}
