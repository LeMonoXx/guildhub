import type { PartyMember } from "@guildhub/contracts";
import { Link } from "@tanstack/react-router";
import { useLocale } from "../../../shared/i18n";
import { formatRelativeTime } from "../../../shared/lib";
import type { MemberToken } from "../model/map-layout";
import { MemberAvatar } from "./member-avatar";
import { PartyIcon } from "./party-icon";

interface MapTokenProps {
  readonly token: MemberToken;
  readonly member: PartyMember;
  readonly order: number;
  readonly lit: boolean;
  readonly dimmed: boolean;
  readonly onHover: (on: boolean) => void;
}

export function MapToken({
  token,
  member,
  order,
  lit,
  dimmed,
  onHover,
}: MapTokenProps) {
  const { t, locale } = useLocale();
  const hover = (on: boolean) => () => {
    onHover(on);
  };
  return (
    <Link
      to="/characters/$characterSlug"
      params={{ characterSlug: member.slug }}
      className="party-token"
      data-lit={lit}
      data-dimmed={dimmed}
      style={{
        left: `${String(token.point.x * 100)}%`,
        top: `${String(token.point.y * 100)}%`,
        ["--order" as string]: String(order),
      }}
      aria-label={t("party.tokenLabel", {
        name: member.name,
        level: member.level,
        area: token.place.dungeon
          ? t(`dungeon.${token.place.dungeon.key}`)
          : (member.focus?.area ?? ""),
      })}
      onPointerEnter={hover(true)}
      onPointerLeave={hover(false)}
      onFocus={hover(true)}
      onBlur={hover(false)}
    >
      <span className="party-token-body">
        <span className="party-token-pulse" aria-hidden="true" />
        <MemberAvatar member={member} />
        <span className="party-token-tip" aria-hidden="true">
          <strong style={{ color: `var(--class-${member.classId})` }}>
            {member.name}
          </strong>
          <span>
            {t("party.level", { level: member.level })}
            {member.focus !== undefined && ` · ${member.focus.area}`}
          </span>
          <span className="party-token-roles">
            {member.roles.map((role) => (
              <PartyIcon key={role} icon={role} />
            ))}
          </span>
          {member.lastLoginAt !== undefined && (
            <span className="muted">
              {t("party.seen", {
                when: formatRelativeTime(member.lastLoginAt, locale),
              })}
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}
