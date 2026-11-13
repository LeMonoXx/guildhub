import { describe, expect, it } from "vitest";
import { createLogger } from "../observability/logger.js";
import { createApp } from "./app.js";

const logger = createLogger({
  level: "silent",
  serviceName: "guildhub-api-test",
});

function app() {
  return createApp({
    logger,
    serviceName: "guildhub-api-test",
  });
}

describe("GET /health/live", () => {
  it("reports the process as ok", async () => {
    const response = await app().request("/health/live");

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f-]{27}$/,
    );
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("keeps /health as a live alias", async () => {
    const response = await app().request("/health");
    expect(response.status).toBe(200);
  });
});

describe("GET /health/ready", () => {
  it("is not ready when no database is configured", async () => {
    const response = await app().request("/health/ready");
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ status: "not_ready" });
  });
});

describe("problem responses", () => {
  it("returns RFC 9457 JSON for unknown routes", async () => {
    const response = await app().request("/missing");

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toMatch(
      /application\/problem\+json/,
    );
    await expect(response.json()).resolves.toMatchObject({
      type: "/problems/request.not_found",
      title: "This resource was not found.",
      status: 404,
      instance: "/missing",
      code: "request.not_found",
    });
  });
});
