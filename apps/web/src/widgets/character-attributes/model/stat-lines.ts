import type { CharacterStatistics } from "@guildhub/contracts";

export interface StatLine {
  readonly key: string;
  readonly value: number;
  readonly digits?: number;
  readonly suffix?: string;
}

export interface StatGroups {
  readonly melee: readonly StatLine[];
  readonly ranged: readonly StatLine[];
  readonly spell: readonly StatLine[];
  readonly defense: readonly StatLine[];
}

export function statGroups(statistics: CharacterStatistics): StatGroups {
  const { mainHand, offHand } = statistics.melee;
  return {
    melee: [
      { key: "attackPower", value: statistics.melee.attackPower },
      { key: "crit", value: statistics.melee.crit, digits: 2, suffix: "%" },
      { key: "hit", value: statistics.melee.hit, digits: 0, suffix: "%" },
      ...(mainHand
        ? [
            { key: "mainHandDps", value: mainHand.dps, digits: 1 },
            { key: "mainHandSpeed", value: mainHand.speed, digits: 2 },
          ]
        : []),
      ...(offHand && offHand.dps > 2
        ? [{ key: "offHandDps", value: offHand.dps, digits: 1 }]
        : []),
    ],
    ranged: [
      { key: "attackPower", value: statistics.ranged.attackPower },
      { key: "crit", value: statistics.ranged.crit, digits: 2, suffix: "%" },
      { key: "hit", value: statistics.ranged.hit, suffix: "%" },
      { key: "damageMin", value: statistics.ranged.min },
      { key: "damageMax", value: statistics.ranged.max },
    ],
    spell: [
      { key: "spellPower", value: statistics.spell.power },
      { key: "healing", value: statistics.spell.healing },
      { key: "crit", value: statistics.spell.crit, digits: 2, suffix: "%" },
      { key: "hit", value: statistics.spell.hit, suffix: "%" },
      { key: "manaRegen", value: statistics.spell.manaRegen },
      { key: "manaRegenCombat", value: statistics.spell.manaRegenCombat },
    ],
    defense: [
      ...(statistics.armor
        ? [{ key: "armor", value: statistics.armor.effective }]
        : []),
      ...(statistics.defense
        ? [{ key: "defense", value: statistics.defense.effective }]
        : []),
      {
        key: "dodge",
        value: statistics.defenses.dodge,
        digits: 2,
        suffix: "%",
      },
      {
        key: "parry",
        value: statistics.defenses.parry,
        digits: 2,
        suffix: "%",
      },
      {
        key: "block",
        value: statistics.defenses.block,
        digits: 2,
        suffix: "%",
      },
    ],
  };
}
