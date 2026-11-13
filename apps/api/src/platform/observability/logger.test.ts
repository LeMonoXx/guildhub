import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger } from "./logger.js";

describe("createLogger", () => {
  it("writes JSON and redacts secrets", () => {
    const output = new PassThrough();
    let line = "";
    output.on("data", (chunk: Buffer) => {
      line += chunk.toString("utf8");
    });
    const logger = createLogger(
      { level: "info", serviceName: "guildhub-api-test" },
      output,
    );
    logger.info(
      { authorization: "Bearer secret", module: "test" },
      "observable",
    );

    const record = JSON.parse(line) as Record<string, unknown>;
    expect(record).toMatchObject({
      level: 30,
      service: "guildhub-api-test",
      module: "test",
      authorization: "[Redacted]",
      msg: "observable",
    });
  });
});
