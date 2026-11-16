import { describe, expect, test } from "vitest";
import { modelPollInterval, modelsPollInterval } from "./model-poll";

describe("modelPollInterval", () => {
  test("backs off for pending looks without bake news", () => {
    expect(modelPollInterval({ status: "ready" }, 0)).toBe(false);
    expect(modelPollInterval(undefined, 0)).toBe(false);
    expect(modelPollInterval({ status: "pending" }, 0)).toBe(2_000);
    expect(modelPollInterval({ status: "pending" }, 3_000)).toBe(4_000);
    expect(modelPollInterval({ status: "pending" }, 10_000)).toBe(8_000);
    expect(modelPollInterval({ status: "pending" }, 20_000)).toBe(15_000);
  });

  test("follows a running bake closely and a queue loosely", () => {
    const baking = {
      status: "pending",
      bake: { state: "baking", fraction: 0.3 },
    } as const;
    const queued = {
      status: "pending",
      bake: { state: "queued", position: 3 },
    } as const;
    expect(modelPollInterval(baking, 60_000)).toBe(2_000);
    expect(modelPollInterval(queued, 60_000)).toBe(5_000);
    expect(modelPollInterval(queued, 20 * 60_000)).toBe(false);
  });

  test("asks as soon as the most active model wants", () => {
    expect(
      modelsPollInterval(
        [
          { status: "ready" },
          { status: "pending", bake: { state: "queued", position: 1 } },
          { status: "pending", bake: { state: "opening" } },
        ],
        60_000,
      ),
    ).toBe(2_000);
    expect(modelsPollInterval([{ status: "ready" }, undefined], 0)).toBe(false);
  });
});
