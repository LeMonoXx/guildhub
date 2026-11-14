import type { FeaturedMember } from "@guildhub/contracts";
import { keepsGearDown } from "./gear-stances";
import { SeededRandom } from "./seeded-random";
import { clipValue, type ClipValue } from "./stage-motion";
import type { TroopPlace } from "./troop-place";

export interface ClipKeyframe {
  readonly timeMs: number;
  readonly value: ClipValue;
}

/** When an actor arrives, stops and turns to the camera. */
export interface SettleTiming {
  readonly settledAt: number;
  readonly facedAt: number;
}

/** What an actor does once it reached its slot. */
export interface SettleRoutine {
  clips(member: FeaturedMember, timing: SettleTiming): ClipKeyframe[];
}

type Posture = "stand" | "kneel";

const idlePool = ["Stand", "Ready1H", "StealthStand"] as const;
const movingPoses: ReadonlySet<string> = new Set(["Walk", "Run", "KneelLoop"]);
const idleBeatMs = 2200;
const idleBeatJitterMs = 80;

/** The pose a member holds when standing still; moving poses fall back to "Stand". */
export const stancePose = (pose: string): string =>
  movingPoses.has(pose) ? "Stand" : pose;

/** The member's own stance, unless it would raise their gear. */
const restingStance = (member: FeaturedMember): string => {
  const stance = stancePose(member.pose);
  return keepsGearDown(member)(stance) ? stance : "Stand";
};

/** A few idle beats that start and end in the member's own stance. */
export const idleRoutine = (
  seedText: string,
  hold: string,
  allowed: (clip: string) => boolean = () => true,
): readonly { readonly clip: string; readonly durationMs: number }[] => {
  const random = SeededRandom.from(seedText);
  const pool = random.shuffle(
    [...new Set([hold, ...idlePool])].filter(
      (clip) => clip === hold || allowed(clip),
    ),
  );
  const beats = [hold];
  const count = 3 + random.below(2);
  while (beats.length < count) {
    const choices = pool.filter((clip) => clip !== beats.at(-1));
    beats.push(choices[random.below(choices.length)] ?? hold);
  }
  if (beats.at(-1) !== hold) beats.push(hold);
  return beats.map((clip) => ({
    clip,
    durationMs: idleBeatMs + random.below(9) * idleBeatJitterMs,
  }));
};

class IdleSettle implements SettleRoutine {
  clips(member: FeaturedMember, timing: SettleTiming): ClipKeyframe[] {
    let cursor = timing.settledAt;
    return idleRoutine(
      member.slug,
      restingStance(member),
      keepsGearDown(member),
    ).map((beat, index) => {
      const keyframe = {
        timeMs: cursor,
        value: clipValue(beat.clip, `${member.slug}-idle-${String(index)}`, {
          crossfadeMs: 240,
        }),
      };
      cursor += beat.durationMs;
      return keyframe;
    });
  }
}

class KneelSettle implements SettleRoutine {
  clips(member: FeaturedMember, timing: SettleTiming): ClipKeyframe[] {
    return [
      {
        timeMs: timing.settledAt,
        value: clipValue(restingStance(member), `${member.slug}-plant`, {
          crossfadeMs: 180,
        }),
      },
      {
        timeMs: timing.facedAt + 80,
        value: clipValue("KneelStart", `${member.slug}-kneel-start`, {
          crossfadeMs: 140,
          loop: false,
        }),
      },
      {
        timeMs: timing.facedAt + 860,
        value: clipValue("KneelLoop", `${member.slug}-kneel`, {
          crossfadeMs: 80,
        }),
      },
    ];
  }
}

const routines: Readonly<Record<Posture, SettleRoutine>> = {
  stand: new IdleSettle(),
  kneel: new KneelSettle(),
};

export const settleRoutineFor = (place: TroopPlace): SettleRoutine =>
  routines[place.kneels ? "kneel" : "stand"];
