import { describe, expect, it } from "vitest";
import {
  characterAppearanceEndpoint,
  characterEquipmentEndpoint,
  characterMediaEndpoint,
} from "./wow-forever-character.js";

describe("wow-forever character endpoints", () => {
  it("addresses appearance, equipment, and media by name and surname", () => {
    expect(characterAppearanceEndpoint("Twitoc", "Grabeswacht")).toMatchObject({
      namespace: "profile-forever",
      path: "/profile/wow/character/twitoc-grabeswacht/appearance",
    });
    expect(characterEquipmentEndpoint("Twitoc", "Grabeswacht").path).toBe(
      "/profile/wow/character/twitoc-grabeswacht/equipment",
    );
    expect(characterMediaEndpoint("Twitoc", "Grabeswacht").path).toBe(
      "/profile/wow/character/twitoc-grabeswacht/character-media",
    );
  });

  it("keeps accents because they are part of the Forever key", () => {
    expect(characterAppearanceEndpoint("Memento", "Morí").path).toBe(
      "/profile/wow/character/memento-mor%C3%AD/appearance",
    );
    expect(characterAppearanceEndpoint("Dendex", "Knørsok").path).toBe(
      "/profile/wow/character/dendex-kn%C3%B8rsok/appearance",
    );
  });
});
