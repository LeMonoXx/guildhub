import { describe, expect, test } from "vitest";
import { createFixtureCharacterSource } from "./fixture-source";
import { characterQueries } from "./queries";
import { CharacterNotFoundError } from "./source";

describe("character fixture queries", () => {
  test("returns a featured identity by slug", async () => {
    const queries = characterQueries(createFixtureCharacterSource());
    const character = await queries.detail("shade").queryFn();
    expect(character.slug).toBe("shade");
    expect(character.pose).toBe("Stand");
    expect(character.lookManifest).toBe("/assets/looks/fixed/look.json");
  });

  test("diagnoses unknown slugs", async () => {
    const queries = characterQueries(createFixtureCharacterSource());
    await expect(queries.detail("missing").queryFn()).rejects.toBeInstanceOf(
      CharacterNotFoundError,
    );
  });
});
