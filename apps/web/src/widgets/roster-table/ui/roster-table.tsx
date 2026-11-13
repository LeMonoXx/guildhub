import type { GuildRosterMember } from "@guildhub/contracts";
import { Link } from "@tanstack/react-router";
import { useLocale } from "../../../shared/i18n";

interface RosterTableProps {
  readonly members: readonly GuildRosterMember[];
}

export function RosterTable({ members }: RosterTableProps) {
  const { t } = useLocale();
  return (
    <div className="roster-table-wrap">
      <table className="roster-table">
        <thead>
          <tr>
            <th>{t("members.search")}</th>
            <th>{t("members.class")}</th>
            <th>{t("members.race")}</th>
            <th>{t("members.rank")}</th>
            <th>{t("members.level")}</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member, index) => {
            const slug =
              member.slug ??
              member.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
            return (
              <tr key={member.characterId}>
                <th scope="row">
                  <Link
                    to="/characters/$characterSlug"
                    params={{ characterSlug: slug }}
                    className="reveal-name"
                    style={{ animationDelay: `${String(index * 40)}ms` }}
                  >
                    {member.name} {member.surname}
                  </Link>
                </th>
                <td>{t(`class.${member.classId}`)}</td>
                <td>{t(`race.${member.raceId}`)}</td>
                <td>{t(`rank.${String(member.rankId)}`)}</td>
                <td>{member.level}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
