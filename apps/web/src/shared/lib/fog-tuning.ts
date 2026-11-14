/** Multipliers for the page fog; 1 is the designed look. */
export interface FogTuning {
  /** Fog density around the stage floor and the characters. */
  readonly stage: number;
  /** How hard the pointer pushes and clears the fog. */
  readonly mouse: number;
  /** How strongly moving characters stir the fog. */
  readonly figures: number;
  /** Opacity of the fog layer drawn in front of the characters. */
  readonly veil: number;
  /** How much background fog stays behind the troop, where the front fog takes over. */
  readonly behind: number;
}

export const defaultFogTuning: FogTuning = {
  stage: 1,
  mouse: 1,
  figures: 1,
  veil: 1,
  behind: 0.3,
};

const keys = Object.keys(defaultFogTuning) as (keyof FogTuning)[];
const limit = 10;

/**
 * A development knob for comparing looks without a rebuild:
 * `?fog=stage:1.5,mouse:0.5,figures:2,veil:0,behind:1` scales each part. Values are
 * clamped to 0 to 10; unknown keys and non-numbers are ignored.
 */
export const readFogTuning = (
  search: string = globalThis.location.search,
): FogTuning => {
  const raw = new URLSearchParams(search).get("fog");
  if (!raw) return defaultFogTuning;
  const tuning: Record<keyof FogTuning, number> = { ...defaultFogTuning };
  for (const pair of raw.split(",")) {
    const [key, value] = pair.split(":");
    const amount = Number(value);
    if (
      value !== undefined &&
      value.trim() !== "" &&
      keys.includes(key as keyof FogTuning) &&
      Number.isFinite(amount)
    ) {
      tuning[key as keyof FogTuning] = Math.min(limit, Math.max(0, amount));
    }
  }
  return tuning;
};
