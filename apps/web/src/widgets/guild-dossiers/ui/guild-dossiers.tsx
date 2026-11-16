import type { GuildDossier } from "@guildhub/contracts";
import { useState } from "react";
import { useLocale } from "../../../shared/i18n";
import { Reveal } from "../../../shared/ui";
import {
  dossierOrders,
  sortDossiers,
  type DossierOrder,
} from "../model/dossier-order";
import { DossierCard } from "./dossier-card";

interface GuildDossiersProps {
  readonly dossiers: readonly GuildDossier[];
}

export function GuildDossiers({ dossiers }: GuildDossiersProps) {
  const { t } = useLocale();
  const [order, setOrder] = useState<DossierOrder>("level");
  return (
    <div className="dossiers">
      <div className="segmented" role="group" aria-label={t("dossiers.sort")}>
        {dossierOrders.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={order === option}
            onClick={() => {
              setOrder(option);
            }}
          >
            {t(`dossiers.order.${option}`)}
          </button>
        ))}
      </div>
      <ul className="dossier-grid">
        {sortDossiers(dossiers, order).map((dossier, index) => (
          <Reveal key={dossier.slug} as="li" delayMs={(index % 8) * 50}>
            <DossierCard dossier={dossier} />
          </Reveal>
        ))}
      </ul>
    </div>
  );
}
