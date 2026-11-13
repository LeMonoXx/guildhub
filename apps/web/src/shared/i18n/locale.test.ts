import { describe, expect, test } from "vitest";
import {
  applyDocumentLocale,
  isLocale,
  localeFromNavigator,
  readStoredLocale,
  writeStoredLocale,
} from "./locale";

describe("locale helpers", () => {
  test("accepts only configured locales", () => {
    expect(isLocale("de")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
  });

  test("maps German navigator languages to de", () => {
    expect(localeFromNavigator("de-AT")).toBe("de");
    expect(localeFromNavigator("en-GB")).toBe("en");
  });

  test("persists and restores the user choice", () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
    };
    writeStoredLocale("de", storage);
    expect(readStoredLocale(storage)).toBe("de");
  });

  test("updates the document language", () => {
    const documentElement = { lang: "en", setAttribute: () => undefined } as {
      lang: string;
      setAttribute: (name: string, value: string) => void;
    };
    documentElement.setAttribute = (name, value) => {
      if (name === "lang") documentElement.lang = value;
    };
    applyDocumentLocale("de", { documentElement });
    expect(documentElement.lang).toBe("de");
  });
});
