import { describe, expect, it } from "vitest";
import { instanceConfigSchema } from "./instance.js";

describe("instanceConfigSchema", () => {
  it("accepts a configured guild instance", () => {
    expect(
      instanceConfigSchema.parse({
        slug: "example-guild",
        name: "Example Guild",
        region: "eu",
        guild: { slug: "example-guild" },
      }),
    ).toEqual({
      slug: "example-guild",
      name: "Example Guild",
      region: "eu",
      guild: { slug: "example-guild" },
    });
  });

  it("rejects an uppercase slug", () => {
    const result = instanceConfigSchema.safeParse({
      slug: "ExampleGuild",
      name: "Example Guild",
      region: "eu",
      guild: { slug: "example-guild" },
    });

    expect(result.success).toBe(false);
  });
});
