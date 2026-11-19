import { publicIconUrl } from "../../character/index.js";
import type { Celebration } from "../domain/celebration.js";

type CelebrationOf<K extends Celebration["kind"]> = Extract<
  Celebration,
  { kind: K }
>;

/** Game icons by Battle.net's skill line of each classic profession. */
const PROFESSION_ICONS: Readonly<Record<number, number>> = {
  129: 135966,
  164: 136241,
  165: 136247,
  171: 136240,
  182: 136246,
  185: 133971,
  186: 136248,
  197: 136249,
  202: 136243,
  333: 136244,
  356: 136245,
  393: 134366,
};

const LEVEL_CAP_ICON = 236567;
const REVERED_ICON = 236681;
const EXALTED_ICON = 236688;
const EXALTED_TIER = 7;
const ACHIEVEMENTS_ICON = 236671;

type Images = {
  readonly [K in Celebration["kind"]]: (
    celebration: CelebrationOf<K>,
  ) => string | undefined;
};

const iconOf = (iconId: number | undefined) =>
  iconId === undefined ? undefined : publicIconUrl(iconId);

const images: Images = {
  levelCap: () => iconOf(LEVEL_CAP_ICON),
  profession: ({ professionId }) =>
    iconOf(
      professionId === undefined ? undefined : PROFESSION_ICONS[professionId],
    ),
  reputation: ({ tier }) =>
    iconOf(tier >= EXALTED_TIER ? EXALTED_ICON : REVERED_ICON),
  achievements: () => iconOf(ACHIEVEMENTS_ICON),
  achievement: ({ iconUrl }) => iconUrl,
};

/** The picture a post shows beside its text: what happened, never who. */
export function celebrationImage(celebration: Celebration): string | undefined {
  const image = images[celebration.kind] as (
    celebration: Celebration,
  ) => string | undefined;
  return image(celebration);
}
