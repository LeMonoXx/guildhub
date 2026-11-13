import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { createLogger } from "./platform/observability/logger.js";

const logger = createLogger({
  level: "silent",
  serviceName: "guildhub-api-test",
});

describe("GET /health", () => {
  it("reports the process as ok", async () => {
    const response = await createApp({
      logger,
      serviceName: "guildhub-api-test",
    }).request("/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f-]{27}$/,
    );
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });
});
