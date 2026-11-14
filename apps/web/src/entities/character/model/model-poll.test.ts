import { describe, expect, test } from "vitest";
import { modelPollInterval } from "./model-poll";

describe("modelPollInterval", () => {
  test("only polls pending looks and gives up after two minutes", () => {
    expect(modelPollInterval("ready", 0)).toBe(false);
    expect(modelPollInterval("pending", 0)).toBe(2_000);
    expect(modelPollInterval("pending", 3_000)).toBe(4_000);
    expect(modelPollInterval("pending", 10_000)).toBe(8_000);
    expect(modelPollInterval("pending", 20_000)).toBe(15_000);
    expect(modelPollInterval("pending", 120_000)).toBe(false);
  });
});
