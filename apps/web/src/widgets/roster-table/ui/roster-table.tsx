import type { GuildRosterMember } from "@guildhub/contracts";
import { Link } from "@tanstack/react-router";
import {
  ClassColoredName,
  ClassMark,
  RaceMark,
  wowClassColorVar,
} from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";

interface RosterTableProps {
  readonly members: readonly GuildRosterMember[];
}

const memberSlug = (member: GuildRosterMember): string =>
  member.slug ?? member.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");

export function RosterTable({ members }: RosterTableProps) {
  const { t } = useLocale();
  return (
    <div className="roster-table-wrap">
      <table className="roster-table">
        <thead>
          <tr>
            <th>{t("members.name")}</th>
            <th>{t("members.class")}</th>
            <th>{t("members.race")}</th>
            <th>{t("members.rank")}</th>
            <th>{t("members.level")}</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member, index) => (
            <tr
              key={member.characterId}
              style={{
                ["--row-class" as string]: wowClassColorVar(member.classId),
              }}
            >
              <th scope="row">
                <div className="roster-identity">
                  <ClassMark classId={member.classId} />
                  <div className="roster-identity-text">
                    <ClassColoredName classId={member.classId}>
                      <Link
                        to="/characters/$characterSlug"
                        params={{ characterSlug: memberSlug(member) }}
                        className="reveal-name roster-name"
                        style={{ animationDelay: `${String(index * 40)}ms` }}
                      >
                        {member.name}
                      </Link>
                    </ClassColoredName>
                    <span className="roster-surname">{member.surname}</span>
                  </div>
                </div>
              </th>
              <td>
                <span className="wow-badge">
                  <ClassMark classId={member.classId} />
                  <ClassColoredName classId={member.classId}>
                    {t(`class.${member.classId}`)}
                  </ClassColoredName>
                </span>
              </td>
              <td>
                <span className="wow-badge">
                  <RaceMark raceId={member.raceId} />
                  <span>{t(`race.${member.raceId}`)}</span>
                </span>
              </td>
              <td>{t(`rank.${String(member.rankId)}`)}</td>
              <td className="roster-level">{member.level}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
