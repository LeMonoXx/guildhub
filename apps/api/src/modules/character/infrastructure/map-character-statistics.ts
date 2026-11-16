import type { StatisticGroup } from "@guildhub/contracts";
import {
  int,
  isoFromMillis,
  list,
  name,
  num,
  optional,
  rec,
  str,
} from "../../../platform/blizzard/document.js";
import type { CharacterProfileData } from "../domain/profile.js";

const PRIMARY_STATS = ["strength", "agility", "stamina", "intellect", "spirit"];
const RESISTANCES = ["fire", "nature", "frost", "shadow", "arcane"];

/** The character sheet: health, attributes, and combat ratings. */
export function mapStatistics(
  value: unknown,
): CharacterProfileData["statistics"] {
  if (value === undefined) return undefined;
  const s = rec(value);
  const rating = (entry: unknown) => num(rec(entry).value) ?? 0;
  const hand = (prefix: string) => {
    const max = num(s[`${prefix}_damage_max`]) ?? 0;
    if (max <= 0) return undefined;
    return {
      min: num(s[`${prefix}_damage_min`]) ?? 0,
      max,
      speed: num(s[`${prefix}_speed`]) ?? 0,
      dps: num(s[`${prefix}_dps`]) ?? 0,
    };
  };
  return {
    health: num(s.health) ?? 0,
    power: num(s.power) ?? 0,
    ...optional("powerType", name(s.power_type)),
    primary: PRIMARY_STATS.flatMap((type) => {
      const entry = statPair(s[type]);
      return entry === undefined ? [] : [{ type, ...entry }];
    }),
    ...optional("armor", statPair(s.armor)),
    ...optional("defense", statPair(s.defense)),
    resistances: RESISTANCES.flatMap((school) => {
      const entry = statPair(s[`${school}_resistance`]);
      return entry === undefined ? [] : [{ school, ...entry }];
    }),
    melee: {
      attackPower: num(s.attack_power) ?? 0,
      crit: rating(s.melee_crit),
      hit: rating(s.melee_hit),
      ...optional("mainHand", hand("main_hand")),
      ...optional("offHand", hand("off_hand")),
    },
    ranged: {
      attackPower: num(s.ranged_attack_power) ?? 0,
      crit: rating(s.ranged_crit),
      hit: rating(s.ranged_hit),
      min: num(s.ranged_damage_min) ?? 0,
      max: num(s.ranged_damage_max) ?? 0,
    },
    spell: {
      power: num(s.spell_power) ?? 0,
      healing: num(s.spell_healing) ?? 0,
      crit: rating(s.spell_crit),
      hit: rating(s.spell_hit),
      penetration: num(s.spell_penetration) ?? 0,
      manaRegen: num(s.mana_regen) ?? 0,
      manaRegenCombat: num(s.mana_regen_combat) ?? 0,
    },
    defenses: {
      dodge: rating(s.dodge),
      parry: rating(s.parry),
      block: rating(s.block),
    },
    ...optional("movementSpeed", num(s.movement_speed)),
  };
}

function statPair(entry: unknown) {
  const record = rec(entry);
  const base = num(record.base);
  const effective = num(record.effective);
  return base === undefined || effective === undefined
    ? undefined
    : { base, effective };
}

/** Achievement statistics, one group per category and sub-category. */
export function mapStatisticGroups(value: unknown): StatisticGroup[] {
  return list(rec(value).categories).flatMap((category) => {
    const record = rec(category);
    return [record, ...list(record.sub_categories).map(rec)].flatMap(
      statisticGroup,
    );
  });
}

function statisticGroup(record: Record<string, unknown>): StatisticGroup[] {
  const id = int(record.id);
  const label = str(record.name);
  const entries = list(record.statistics).flatMap((entry) => {
    const statistic = rec(entry);
    const entryName = str(statistic.name);
    const quantity = num(statistic.quantity);
    if (!entryName || quantity === undefined) return [];
    return [
      {
        name: entryName,
        quantity,
        ...optional("detail", str(statistic.description)),
        ...optional("at", isoFromMillis(statistic.last_updated_timestamp)),
      },
    ];
  });
  if (id === undefined || !label || entries.length === 0) return [];
  return [{ id, name: label, entries }];
}
