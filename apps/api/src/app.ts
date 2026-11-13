import {
  structuredLogger,
  type StructuredLoggerEnv,
} from "@hono/structured-logger";
import { httpInstrumentationMiddleware } from "@hono/otel";
import { Hono } from "hono";
import { requestId, type RequestIdVariables } from "hono/request-id";
import { routePath } from "hono/route";
import type { Logger } from "pino";

type AppEnv = StructuredLoggerEnv<Logger> & {
  Variables: RequestIdVariables;
};

export interface AppConfig {
  readonly logger: Logger;
  readonly serviceName: string;
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
        } else if (route.startsWith("/health")) {
          logger.debug(fields, "health request completed");
        } else {
          logger.info(fields, "request completed");
        }
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
  app.get("/health", (context) => context.json({ status: "ok" }));

  return app;
}
