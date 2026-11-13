import { describe, expect, it } from "vitest";
import { startTelemetry } from "./telemetry.js";

describe("startTelemetry", () => {
  it("is a no-op when no OTLP endpoint is configured", async () => {
    const telemetry = startTelemetry({
      serviceName: "guildhub-api-test",
    });

    expect(telemetry.enabled).toBe(false);
    await expect(telemetry.shutdown()).resolves.toBeUndefined();
  });
});
