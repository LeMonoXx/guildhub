import type { BlizzardApiClient } from "@blizzard-api/client";
import {
  defaultContentLocale,
  type AchievementDetails,
  type ContentLocale,
} from "@guildhub/contracts";
import type { BattleNetResource } from "../../../platform/blizzard/request.js";
import { mapLimited } from "../../../platform/kernel/map-limited.js";
import { sendCharacterRequest } from "./battle-net-request.js";
import {
  achievementEndpoint,
  achievementMediaEndpoint,
} from "./wow-forever-character.js";

const REQUEST_CONCURRENCY = 6;
const CRITERIA_LIMIT = 8;

export interface AchievementInfo {
  readonly iconId?: number;
  readonly details?: AchievementDetails;
}

/**
 * Achievement texts and icons are static game data, so each id is fetched
 * once per process. Only answers that will not change are remembered: a
 * success or a definite "not found", never a temporary failure.
 */
export class BattleNetAchievementCatalog {
  private readonly known = new Map<number, AchievementInfo>();

  constructor(
    private readonly client: BlizzardApiClient,
    private readonly locale: ContentLocale = defaultContentLocale,
  ) {}

  async lookup(
    ids: readonly number[],
  ): Promise<ReadonlyMap<number, AchievementInfo>> {
    const missing = [...new Set(ids)].filter((id) => !this.known.has(id));
    await mapLimited(missing, REQUEST_CONCURRENCY, async (id) => {
      const [achievement, media] = await Promise.all([
        this.fetch(achievementEndpoint(id)),
        this.fetch(achievementMediaEndpoint(id)),
      ]);
      if (!achievement.settled || !media.settled) return;
      this.known.set(id, {
        ...optional("iconId", iconIdOf(media.body)),
        ...optional("details", detailsOf(achievement.body)),
      });
    });
    return new Map(
      ids.flatMap((id) => {
        const info = this.known.get(id);
        return info === undefined ? [] : [[id, info] as const];
      }),
    );
  }

  private async fetch(
    resource: BattleNetResource,
  ): Promise<{ settled: boolean; body?: unknown }> {
    const result = await sendCharacterRequest(
      this.client,
      resource,
      this.locale,
    );
    if (result.ok) return { settled: true, body: result.value };
    return { settled: result.error.code === "character.not_found" };
  }
}

export function detailsOf(body: unknown): AchievementDetails | undefined {
  const record = asRecord(body);
  const description = text(record.description);
  const criteria = criteriaOf(record.criteria, description);
  const details: AchievementDetails = {
    ...optional("description", description),
    ...optional("category", text(asRecord(record.category).name)),
    ...optional("reward", text(record.reward_description)),
    ...(criteria.length === 0 ? {} : { criteria }),
  };
  return Object.keys(details).length === 0 ? undefined : details;
}

/** Child criteria are the checklist; a lone criterion that repeats the description adds nothing. */
function criteriaOf(value: unknown, description: string | undefined): string[] {
  const root = asRecord(value);
  const children = Array.isArray(root.child_criteria)
    ? root.child_criteria
    : [];
  const lines = (children.length > 0 ? children : [root])
    .map((child) => text(asRecord(child).description))
    .filter(
      (line): line is string => line !== undefined && line !== description,
    );
  return [...new Set(lines)].slice(0, CRITERIA_LIMIT);
}

function iconIdOf(media: unknown): number | undefined {
  const assets = asRecord(media).assets;
  if (!Array.isArray(assets)) return undefined;
  const icon = assets.map(asRecord).find((asset) => asset.key === "icon");
  return typeof icon?.file_data_id === "number" ? icon.file_data_id : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

function optional<K extends string, V>(
  key: K,
  value: V | undefined,
): { [P in K]?: V } {
  return value === undefined ? {} : ({ [key]: value } as { [P in K]: V });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}
