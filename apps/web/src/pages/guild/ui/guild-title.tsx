import type { GuildProfileResponse } from "@guildhub/contracts";
import { useLocale } from "../../../shared/i18n";
import { Wordmark } from "../../../shared/ui";

export function GuildTitle({
  guild,
  heading,
  showLine = true,
}: {
  readonly guild: GuildProfileResponse;
  readonly heading?: boolean;
  readonly showLine?: boolean;
}) {
  const { t } = useLocale();
  return (
    <>
      <p className={heading ? "eyebrow masthead-eyebrow" : "eyebrow"}>
        {t("home.eyebrow", { faction: t(`faction.${guild.faction}`) })}
      </p>
      <Wordmark text={guild.name} as={heading ? "h1" : "p"} />
      {showLine ? <p className="guild-tagline">{t("home.tagline")}</p> : null}
    </>
  );
}
