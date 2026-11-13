import { describe, expect, it } from "vitest";
import { toPostgresUrl } from "./connection-url.js";

describe("toPostgresUrl", () => {
  it("leaves a postgres URI unchanged", () => {
    const url = "postgres://guildhub:guildhub@127.0.0.1:5432/guildhub";
    expect(toPostgresUrl(url)).toBe(url);
  });

  it("converts an Aspire ADO.NET connection string", () => {
    expect(
      toPostgresUrl(
        "Host=localhost;Port=5433;Username=postgres;Password=p@ss:word;Database=guildhub",
      ),
    ).toBe("postgres://postgres:p%40ss%3Aword@localhost:5433/guildhub");
  });
});
