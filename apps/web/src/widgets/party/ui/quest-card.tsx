import type { PartyMember, PartyQuest } from "@guildhub/contracts";
import { useLocale } from "../../../shared/i18n";
import { MemberChip } from "./member-chip";
import { PartyIcon } from "./party-icon";
import { SpotlightTitle, type Spotlight } from "./spotlight-title";

interface QuestCardProps {
  readonly quest: PartyQuest;
  readonly members: ReadonlyMap<string, PartyMember>;
  /** The member whose page this is; everyone else is a partner. */
  readonly self?: string | undefined;
  readonly spotlight?: Spotlight | undefined;
}

export function QuestCard({ quest, members, self, spotlight }: QuestCardProps) {
  const { t } = useLocale();
  const crew = quest.members.flatMap((slug) => {
    const member = members.get(slug);
    return member === undefined || slug === self ? [] : [member];
  });
  const facts = [
    quest.area,
    quest.minLevel === undefined
      ? undefined
      : t("party.fromLevel", { level: quest.minLevel }),
  ].filter(Boolean);
  return (
    <article className="party-card party-quest" data-active={spotlight?.active}>
      <header>
        <PartyIcon icon="quest" />
        <div>
          <SpotlightTitle spotlight={spotlight}>{quest.name}</SpotlightTitle>
          {facts.length > 0 && <p className="muted">{facts.join(" · ")}</p>}
        </div>
        <span className="party-count">
          {t("party.holders", { count: quest.members.length })}
        </span>
      </header>
      <ul className="party-crew">
        {crew.map((member) => (
          <li key={member.slug}>
            <MemberChip member={member} />
          </li>
        ))}
      </ul>
    </article>
  );
}
