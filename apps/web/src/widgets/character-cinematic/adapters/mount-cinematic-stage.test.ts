import type { CinematicScene } from "@guildhub/contracts";
import { describe, expect, test } from "vitest";
import { actorDeclarations } from "./mount-cinematic-stage";

describe("cinematic actor registry", () => {
  test("selects every actor declaration and ignores assets", () => {
    const scene = {
      declarations: [
        {
          kind: "actor",
          id: "shade",
          manifest: "/assets/looks/fixed/look.json",
          character: "shade",
        },
        {
          kind: "actor",
          id: "vesper",
          manifest: "/assets/looks/fixed/look.json",
          character: "vesper",
        },
        { kind: "asset", id: "camera", asset: "stage-camera" },
      ],
    } as CinematicScene;
    expect(actorDeclarations(scene).map((actor) => actor.id)).toEqual([
      "shade",
      "vesper",
    ]);
  });
});
