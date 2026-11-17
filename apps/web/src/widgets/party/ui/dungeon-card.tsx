import type { PartyDungeon, PartyMember } from "@guildhub/contracts";
import { useLocale } from "../../../shared/i18n";
import { MemberChip } from "./member-chip";
import { PartyIcon } from "./party-icon";
import { SpotlightTitle, type Spotlight } from "./spotlight-title";

interface DungeonCardProps {
  readonly dungeon: PartyDungeon;
  readonly members: ReadonlyMap<string, PartyMember>;
  readonly spotlight?: Spotlight | undefined;
}

export function DungeonCard({ dungeon, members, spotlight }: DungeonCardProps) {
  const { t } = useLocale();
  const seats = [
    ...dungeon.group.map((seat) => ({
      ...seat,
      member: members.get(seat.slug),
    })),
    ...dungeon.missing.map((role) => ({
      role,
      slug: undefined,
      member: undefined,
    })),
  ];
  const ready = dungeon.missing.length === 0;
  return (
    <article
      className="party-card party-dungeon"
      data-ready={ready}
      data-active={spotlight?.active}
    >
      <header>
        <PartyIcon icon="portal" className="party-portal" />
        <div>
          <SpotlightTitle spotlight={spotlight}>
            {t(`dungeon.${dungeon.key}`)}
          </SpotlightTitle>
          <p className="muted">
            {t("party.levels", {
              from: dungeon.minLevel,
              to: dungeon.maxLevel,
            })}
            {dungeon.quests.length > 0 &&
              ` · ${t("party.dungeonQuests", { count: dungeon.quests.length })}`}
          </p>
        </div>
        <span className="party-count" data-ready={ready}>
          {ready
            ? t("party.ready")
            : t("party.missing", { count: dungeon.missing.length })}
        </span>
      </header>
      <p className="party-seats-title">{t("party.suggestion")}</p>
      <ol className="party-seats">
        {seats.map((seat, index) => (
          <li
            key={seat.slug ?? `open-${String(index)}`}
            className="party-seat"
            data-open={seat.member === undefined}
            style={{ ["--seat-index" as string]: String(index) }}
          >
            <PartyIcon icon={seat.role} label={t(`party.role.${seat.role}`)} />
            {seat.member === undefined ? (
              <span className="party-seat-open">{t("party.wanted")}</span>
            ) : (
              <MemberChip member={seat.member} />
            )}
          </li>
        ))}
      </ol>
      {dungeon.members.length > dungeon.group.length && (
        <p className="party-bench muted">
          {t("party.bench", {
            count: dungeon.members.length - dungeon.group.length,
          })}
        </p>
      )}
    </article>
  );
}
