import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { createFixtureGuildSource } from "../../../entities/guild";
import { buildLineupScene } from "./build-lineup-scene";

describe("guild lineup scene", () => {
  test("builds one data-driven actor per featured member", async () => {
    const members = (await createFixtureGuildSource().getFeaturedMembers())
      .members;
    const scene = buildLineupScene(members);
    const actors = scene.declarations.filter(
      (declaration) => declaration.kind === "actor",
    );
    expect(actors).toHaveLength(6);
    expect(actors.map((actor) => actor.id)).toEqual(
      members.map((member) => member.slug),
    );
    expect(new Set(actors.map((actor) => actor.manifest)).size).toBe(1);
    for (const member of members) {
      expect(
        scene.tracks.some(
          (track) =>
            track.kind === "clip" &&
            track.target === member.slug &&
            track.keyframes.some(
              (keyframe) => keyframe.value.animationGroup === member.pose,
            ),
        ),
      ).toBe(true);
    }
  });

  test("does not branch on character identity", () => {
    const source = readFileSync(
      join(import.meta.dirname, "build-lineup-scene.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/member\.name\s*===/);
    expect(source).not.toMatch(/if\s*\(\s*member\.slug/);
  });
});
