import { describe, expect, test } from "vitest";
import { defaultFogTuning, readFogTuning } from "./fog-tuning";

describe("readFogTuning", () => {
  test("uses the designed look without a fog parameter", () => {
    expect(readFogTuning("")).toEqual(defaultFogTuning);
    expect(readFogTuning("?lang=de")).toEqual(defaultFogTuning);
  });

  test("scales the named parts and keeps the rest", () => {
    expect(readFogTuning("?fog=stage:1.5,mouse:0.5")).toEqual({
      ...defaultFogTuning,
      stage: 1.5,
      mouse: 0.5,
    });
  });

  test("ignores unknown keys and non-numbers", () => {
    expect(readFogTuning("?fog=colour:2,stage:abc,mouse:")).toEqual(
      defaultFogTuning,
    );
  });

  test("clamps values to 0 to 10", () => {
    expect(readFogTuning("?fog=veil:15,figures:-1,stage:5.5")).toEqual({
      ...defaultFogTuning,
      veil: 10,
      figures: 0,
      stage: 5.5,
    });
  });
});
