import type { GuildDossier } from "@guildhub/contracts";
import { useLocale } from "../../../shared/i18n";
import { formatRelativeTime } from "../../../shared/lib";

/** When the member was last online, or that their profile is private. */
export function DossierSeen({ dossier }: { readonly dossier: GuildDossier }) {
  const { t, locale } = useLocale();
  if (dossier.lastLoginAt)
    return (
      <p className="dossier-seen">
        {t("character.lastSeen", {
          when: formatRelativeTime(dossier.lastLoginAt, locale),
        })}
      </p>
    );
  if (dossier.status === "unavailable")
    return <p className="dossier-seen">{t("dossiers.private")}</p>;
  return null;
}
