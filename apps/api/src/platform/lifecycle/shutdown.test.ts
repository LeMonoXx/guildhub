import pino from "pino";
import { describe, expect, it } from "vitest";
import { runShutdownSteps } from "./shutdown.js";

const logger = pino({ level: "silent" });
const failing = () => Promise.reject(new Error("boom"));

describe("runShutdownSteps", () => {
  it("runs every step even after one failed", async () => {
    const ran: string[] = [];
    await runShutdownSteps(logger, [
      { name: "first", run: failing, required: true },
      {
        name: "second",
        run: () => {
          ran.push("second");
          return Promise.resolve();
        },
        required: true,
      },
    ]);
    expect(ran).toEqual(["second"]);
  });

  it("is clean when only optional steps failed", async () => {
    await expect(
      runShutdownSteps(logger, [
        { name: "optional", run: failing, required: false },
      ]),
    ).resolves.toBe(true);
  });

  it("is not clean when a required step failed", async () => {
    await expect(
      runShutdownSteps(logger, [
        { name: "required", run: failing, required: true },
      ]),
    ).resolves.toBe(false);
  });
});
