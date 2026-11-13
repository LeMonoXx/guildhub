import type { GuildRosterMember } from "@guildhub/contracts";
import { useLocale } from "../../../shared/i18n";
import { uniqueSorted, type RosterFilters } from "../model/filters";

interface RosterFilterProps {
  readonly members: readonly GuildRosterMember[];
  readonly filters: RosterFilters;
  readonly onChange: (filters: RosterFilters) => void;
}

const optionalValue = (value: string): string | undefined =>
  value === "" ? undefined : value;

export function RosterFilter({
  members,
  filters,
  onChange,
}: RosterFilterProps) {
  const { t } = useLocale();
  const classes = uniqueSorted(members.map((member) => member.classId));
  const races = uniqueSorted(members.map((member) => member.raceId));
  const ranks = uniqueSorted(members.map((member) => String(member.rankId)));

  return (
    <form
      className="roster-filter"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <label>
        <span>{t("members.search")}</span>
        <input
          type="search"
          name="q"
          value={filters.q ?? ""}
          onChange={(event) => {
            onChange({ ...filters, q: optionalValue(event.target.value) });
          }}
        />
      </label>
      <label>
        <span>{t("members.class")}</span>
        <select
          name="classId"
          value={filters.classId ?? ""}
          onChange={(event) => {
            onChange({
              ...filters,
              classId: optionalValue(event.target.value),
            });
          }}
        >
          <option value="">{t("members.all")}</option>
          {classes.map((classId) => (
            <option key={classId} value={classId}>
              {t(`class.${classId}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{t("members.race")}</span>
        <select
          name="raceId"
          value={filters.raceId ?? ""}
          onChange={(event) => {
            onChange({ ...filters, raceId: optionalValue(event.target.value) });
          }}
        >
          <option value="">{t("members.all")}</option>
          {races.map((raceId) => (
            <option key={raceId} value={raceId}>
              {t(`race.${raceId}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{t("members.rank")}</span>
        <select
          name="rankId"
          value={filters.rankId === undefined ? "" : String(filters.rankId)}
          onChange={(event) => {
            onChange({
              ...filters,
              rankId:
                event.target.value === ""
                  ? undefined
                  : Number(event.target.value),
            });
          }}
        >
          <option value="">{t("members.all")}</option>
          {ranks.map((rankId) => (
            <option key={rankId} value={rankId}>
              {t(`rank.${rankId}`)}
            </option>
          ))}
        </select>
      </label>
    </form>
  );
}
