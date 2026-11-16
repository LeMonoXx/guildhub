import { describe, expect, test } from "vitest";
import {
  iconIdOf,
  int,
  isoFromMillis,
  nonNegativeInt,
  optional,
  positiveInt,
  str,
} from "./document.js";

describe("Battle.net document readers", () => {
  test("text is trimmed and blank text is absent", () => {
    expect(str("  Thunderfury ")).toBe("Thunderfury");
    expect(str("   ")).toBeUndefined();
    expect(str(7)).toBeUndefined();
  });

  test("numbers keep their own range rules", () => {
    expect(int(12.9)).toBe(12);
    expect(positiveInt(0)).toBeUndefined();
    expect(positiveInt(3)).toBe(3);
    expect(nonNegativeInt(0)).toBe(0);
    expect(nonNegativeInt(1.5)).toBeUndefined();
  });

  test("timestamps are epoch milliseconds", () => {
    expect(isoFromMillis(0)).toBeUndefined();
    expect(isoFromMillis(1_700_000_000_000)).toBe("2023-11-14T22:13:20.000Z");
  });

  test("the icon is the asset keyed icon", () => {
    expect(
      iconIdOf({
        assets: [
          { key: "zoom", file_data_id: 1 },
          { key: "icon", file_data_id: 135_274 },
        ],
      }),
    ).toBe(135_274);
    expect(iconIdOf({ assets: "none" })).toBeUndefined();
  });

  test("optional leaves absent values out entirely", () => {
    expect(optional("a", undefined)).toEqual({});
    expect(optional("a", 0)).toEqual({ a: 0 });
  });
});
