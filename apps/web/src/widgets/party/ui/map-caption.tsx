import type {
  GuildPartyResponse,
  PartyDungeon,
  PartyMember,
} from "@guildhub/contracts";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useLocale } from "../../../shared/i18n";
import { dungeonPlace, type ZoneIndex } from "../model/map-layout";
import type { MapSpotlight } from "../model/map-scene";
import { dungeonsFor, questsWith } from "../model/party-lookup";
import { MemberChip } from "./member-chip";
import { PartyIcon } from "./party-icon";

interface CaptionContext {
  readonly party: GuildPartyResponse;
  readonly members: ReadonlyMap<string, PartyMember>;
  readonly index: ZoneIndex;
}

interface MapCaptionProps extends CaptionContext {
  readonly spotlight: MapSpotlight | undefined;
  readonly pinned: boolean;
}

type CaptionBody<K extends MapSpotlight["kind"]> = (props: {
  readonly spotlight: Extract<MapSpotlight, { kind: K }>;
  readonly context: CaptionContext;
}) => ReactNode;

function DungeonCaption({
  spotlight,
  context,
}: Parameters<CaptionBody<"dungeon">>[0]) {
  const { t } = useLocale();
  const dungeon = context.party.dungeons.find((d) => d.key === spotlight.key);
  if (dungeon === undefined) return null;
  const zone = dungeonPlace(context.index, dungeon)?.zone.name;
  return (
    <>
      <p className="party-caption-eyebrow">{t("party.caption.dungeon")}</p>
      <h3>{t(`dungeon.${dungeon.key}`)}</h3>
      <p className="muted">
        {[
          t("party.levels", { from: dungeon.minLevel, to: dungeon.maxLevel }),
          zone,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <p className="party-caption-boss">
        <span>{t("party.caption.boss")}</span>
        <strong>{t(`boss.${dungeon.key}`)}</strong>
        <span className="muted">
          {dungeon.boss.level === undefined
            ? t("party.caption.skull")
            : t("party.level", { level: dungeon.boss.level })}
        </span>
      </p>
      <p>{t("party.caption.dungeonText", { count: dungeon.members.length })}</p>
      <SuggestedSeats dungeon={dungeon} members={context.members} />
      {dungeon.quests.length > 0 && (
        <p className="muted">
          {t("party.dungeonQuests", { count: dungeon.quests.length })}
        </p>
      )}
    </>
  );
}

function SuggestedSeats({
  dungeon,
  members,
}: {
  readonly dungeon: PartyDungeon;
  readonly members: ReadonlyMap<string, PartyMember>;
}) {
  const { t } = useLocale();
  return (
    <div className="party-caption-seats">
      <p className="party-caption-eyebrow">
        {t("party.suggestion")} ·{" "}
        {dungeon.missing.length === 0
          ? t("party.ready")
          : t("party.missing", { count: dungeon.missing.length })}
      </p>
      <ul>
        {dungeon.group.map((seat) => {
          const member = members.get(seat.slug);
          return (
            <li key={seat.slug}>
              <PartyIcon
                icon={seat.role}
                label={t(`party.role.${seat.role}`)}
              />
              {member === undefined ? seat.slug : member.name}
            </li>
          );
        })}
        {dungeon.missing.map((role, index) => (
          <li key={`open-${String(index)}`} data-open="true">
            <PartyIcon icon={role} label={t(`party.role.${role}`)} />
            {t("party.wanted")}
          </li>
        ))}
      </ul>
    </div>
  );
}

function QuestCaption({
  spotlight,
  context,
}: Parameters<CaptionBody<"quest">>[0]) {
  const { t } = useLocale();
  const quest = context.party.quests.find((q) => q.id === spotlight.id);
  if (quest === undefined) return null;
  return (
    <>
      <p className="party-caption-eyebrow">{t("party.caption.quest")}</p>
      <h3>{quest.name}</h3>
      {quest.area !== undefined && <p className="muted">{quest.area}</p>}
      <p>{t("party.caption.questText", { count: quest.members.length })}</p>
      <ul className="party-crew">
        {quest.members.flatMap((slug) => {
          const member = context.members.get(slug);
          return member === undefined
            ? []
            : [
                <li key={slug}>
                  <MemberChip member={member} />
                </li>,
              ];
        })}
      </ul>
    </>
  );
}

function MemberCaption({
  spotlight,
  context,
}: Parameters<CaptionBody<"member">>[0]) {
  const { t } = useLocale();
  const member = context.members.get(spotlight.slug);
  if (member === undefined) return null;
  const partners = new Set(
    questsWith(context.party, member.slug)
      .flatMap((quest) => quest.members)
      .filter((slug) => slug !== member.slug),
  );
  const dungeons = dungeonsFor(context.party, member.slug);
  return (
    <>
      <p className="party-caption-eyebrow">{t("party.caption.member")}</p>
      <h3 style={{ color: `var(--class-${member.classId})` }}>{member.name}</h3>
      <p className="muted">
        {[t("party.level", { level: member.level }), member.focus?.area]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <p>
        {partners.size === 0
          ? t("party.caption.memberAlone")
          : t("party.caption.memberText", { count: partners.size })}
      </p>
      {dungeons.length > 0 && (
        <p className="muted">
          {t("party.caption.memberDungeons", { count: dungeons.length })}
        </p>
      )}
      <Link
        to="/characters/$characterSlug"
        params={{ characterSlug: member.slug }}
        className="party-caption-link"
      >
        {t("party.openProfile")}
      </Link>
    </>
  );
}

const captionBodies: { readonly [K in MapSpotlight["kind"]]: CaptionBody<K> } =
  {
    dungeon: DungeonCaption,
    quest: QuestCaption,
    member: MemberCaption,
  };

function IdleCaption() {
  const { t } = useLocale();
  return (
    <>
      <p className="party-caption-eyebrow">{t("party.caption.idleTitle")}</p>
      <p>{t("party.caption.idle")}</p>
    </>
  );
}

/** Says in words what the map lights up, so the glow and the lines read as a sentence. */
export function MapCaption({ spotlight, pinned, ...context }: MapCaptionProps) {
  const { t } = useLocale();
  const Body =
    spotlight === undefined
      ? undefined
      : (captionBodies[spotlight.kind] as CaptionBody<MapSpotlight["kind"]>);
  return (
    <section
      className="party-caption"
      aria-label={t("party.caption.label")}
      aria-live="polite"
      data-kind={spotlight?.kind ?? "idle"}
    >
      {Body === undefined || spotlight === undefined ? (
        <IdleCaption />
      ) : (
        <div key={JSON.stringify(spotlight)} className="party-caption-body">
          <Body spotlight={spotlight} context={context} />
          <p className="party-caption-hint">
            {pinned ? t("party.caption.pinned") : t("party.caption.hovered")}
          </p>
        </div>
      )}
    </section>
  );
}
