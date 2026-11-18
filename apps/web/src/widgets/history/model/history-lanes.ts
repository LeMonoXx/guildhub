import type { HistoryEvent } from "@guildhub/contracts";
import type { HistoryEventOf } from "../../../entities/character";

export type MemberRef = Pick<
  HistoryEvent,
  "slug" | "name" | "surname" | "classId" | "avatarUrl"
>;

export type CheckEvent = Exclude<HistoryEvent, { kind: "achievement" }>;

/** Everything one member changed between two hourly checks. */
export interface LaneMoment {
  readonly type: "moment";
  readonly key: string;
  readonly at: string;
  readonly member: MemberRef;
  readonly events: readonly CheckEvent[];
  readonly level?: HistoryEventOf<"level">;
  /** The kind the moment is drawn as. */
  readonly lead: CheckEvent["kind"];
}

/** One achievement, at the time it was earned. */
export interface LaneAchievement {
  readonly type: "achievement";
  readonly key: string;
  readonly at: string;
  readonly member: MemberRef;
  readonly event: HistoryEventOf<"achievement">;
}

export type LaneMark = LaneMoment | LaneAchievement;

/** Marks close enough together to read as one stretch of play. */
export interface LaneSession {
  readonly from: string;
  readonly to: string;
}

export interface HistoryLane {
  readonly member: MemberRef;
  /** Oldest first. */
  readonly marks: readonly LaneMark[];
  readonly sessions: readonly LaneSession[];
}

export interface HistoryLanes {
  /** Newest activity first. */
  readonly lanes: readonly HistoryLane[];
  readonly from: string;
  readonly to: string;
}

const HOUR = 3_600_000;

/** Checks run hourly, so a member who kept playing shows up an hour apart. */
const SESSION_GAP = HOUR + 10 * 60_000;

const LEAD_ORDER: readonly CheckEvent["kind"][] = [
  "level",
  "joined",
  "left",
  "rank",
  "item",
  "mount",
  "reputation",
  "profession",
  "achievements",
  "quests",
];

const memberOf = (ref: MemberRef): MemberRef => ({
  slug: ref.slug,
  name: ref.name,
  surname: ref.surname,
  classId: ref.classId,
  avatarUrl: ref.avatarUrl,
});

const achievementMark = (
  event: HistoryEventOf<"achievement">,
): LaneAchievement => ({
  type: "achievement",
  key: `${event.slug}|achievement|${String(event.achievementId)}`,
  at: event.at,
  member: memberOf(event),
  event,
});

const moment = (key: string, grouped: readonly CheckEvent[]): LaneMoment => {
  const [first] = grouped as [CheckEvent, ...CheckEvent[]];
  const level = grouped.find(
    (event): event is HistoryEventOf<"level"> => event.kind === "level",
  );
  return {
    type: "moment",
    key,
    at: first.at,
    member: memberOf(first),
    events: grouped,
    ...(level === undefined ? {} : { level }),
    lead:
      LEAD_ORDER.find((kind) => grouped.some((e) => e.kind === kind)) ??
      first.kind,
  };
};

const marksOf = (events: readonly HistoryEvent[]): LaneMark[] => {
  const groups = new Map<string, CheckEvent[]>();
  const achievements: LaneAchievement[] = [];
  for (const event of events) {
    if (event.kind === "achievement") {
      achievements.push(achievementMark(event));
      continue;
    }
    const key = `${event.slug}|${event.at}`;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return [
    ...[...groups].map(([key, grouped]) => moment(key, grouped)),
    ...achievements,
  ].sort((a, b) => a.at.localeCompare(b.at));
};

const sessionsOf = (marks: readonly LaneMark[]): LaneSession[] => {
  const sessions: LaneSession[] = [];
  for (const mark of marks) {
    const last = sessions.at(-1);
    if (last && Date.parse(mark.at) - Date.parse(last.to) <= SESSION_GAP)
      sessions[sessions.length - 1] = { from: last.from, to: mark.at };
    else sessions.push({ from: mark.at, to: mark.at });
  }
  return sessions.filter((session) => session.from !== session.to);
};

const newestOf = (lane: HistoryLane) => (lane.marks.at(-1) as LaneMark).at;

/**
 * One lane per member: each hourly check they changed something in is one
 * mark, each achievement another at the time it was earned.
 */
export function historyLanes(
  events: readonly HistoryEvent[],
): HistoryLanes | undefined {
  const marks = marksOf(events);
  const [oldest] = marks;
  const newest = marks.at(-1);
  if (oldest === undefined || newest === undefined) return undefined;
  const bySlug = new Map<string, LaneMark[]>();
  for (const mark of marks)
    bySlug.set(mark.member.slug, [
      ...(bySlug.get(mark.member.slug) ?? []),
      mark,
    ]);
  const lanes = [...bySlug.values()]
    .map((laneMarks) => ({
      member: (laneMarks.at(-1) as LaneMark).member,
      marks: laneMarks,
      sessions: sessionsOf(laneMarks),
    }))
    .sort((a, b) => newestOf(b).localeCompare(newestOf(a)));
  return { lanes, from: oldest.at, to: newest.at };
}

/** The mark worth opening first: the latest level-up, else the latest mark. */
export function featuredMark(lanes: HistoryLanes): LaneMark | undefined {
  const marks = lanes.lanes.flatMap((lane) => lane.marks);
  const newestFirst = [...marks].sort((a, b) => b.at.localeCompare(a.at));
  return (
    newestFirst.find((mark) => mark.type === "moment" && mark.level) ??
    newestFirst[0]
  );
}
