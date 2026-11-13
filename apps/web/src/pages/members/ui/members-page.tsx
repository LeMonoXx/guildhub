import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { guildQueries } from "../../../entities/guild";
import {
  matchesRosterFilters,
  parseRosterSearch,
  RosterFilter,
} from "../../../features/roster-filter";
import { useLocale } from "../../../shared/i18n";
import { asRecord, formatDocumentTitle } from "../../../shared/lib";
import { DocumentTitle, StatusBlock } from "../../../shared/ui";
import { RosterTable } from "../../../widgets/roster-table";

export function MembersPage() {
  const { t } = useLocale();
  const filters = parseRosterSearch(asRecord(useSearch({ strict: false })));
  const navigate = useNavigate({ from: "/members" });
  const roster = useQuery(guildQueries.roster());
  const profile = useQuery(guildQueries.profile());

  if (roster.isPending)
    return <StatusBlock>{t("members.loading")}</StatusBlock>;
  if (roster.isError)
    return <StatusBlock tone="error">{t("members.error")}</StatusBlock>;

  const members = roster.data.members.filter((member) =>
    matchesRosterFilters(member, filters),
  );

  return (
    <article className="members-page">
      <DocumentTitle
        value={formatDocumentTitle(t("members.title"), profile.data?.name)}
      />
      <header>
        <h1>{t("members.title")}</h1>
        <p>{t("members.count", { count: members.length })}</p>
      </header>
      <RosterFilter
        members={roster.data.members}
        filters={filters}
        onChange={(next) => {
          void navigate({ search: next });
        }}
      />
      {members.length === 0 ? (
        <StatusBlock>{t("members.empty")}</StatusBlock>
      ) : (
        <RosterTable members={members} />
      )}
    </article>
  );
}
