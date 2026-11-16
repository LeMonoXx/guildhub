import type {
  GuildChronicleResponse,
  GuildHistoryResponse,
  GuildProfileResponse,
} from "@guildhub/contracts";
import type { ReactNode } from "react";
import type { SectionLink } from "../../../shared/ui";
import { GuildBestiary } from "../../../widgets/guild-bestiary";
import { GuildComposition } from "../../../widgets/guild-composition";
import { GuildCrafters } from "../../../widgets/guild-crafters";
import { GuildDossiers } from "../../../widgets/guild-dossiers";
import { GuildHallOfFame } from "../../../widgets/guild-hall-of-fame";
import { GuildHistory } from "../../../widgets/guild-history";
import { GuildPulse } from "../../../widgets/guild-pulse";
import { GuildTimeline } from "../../../widgets/guild-timeline";

export interface ChronicleSection {
  readonly link: SectionLink;
  readonly eyebrow: string;
  readonly lead?: string;
  readonly body: ReactNode;
}

export const chronicleSections = (
  chronicle: GuildChronicleResponse,
  history: GuildHistoryResponse | undefined,
  guild: GuildProfileResponse,
  t: (key: string, values?: Record<string, string | number>) => string,
): ChronicleSection[] => {
  const sections: (ChronicleSection | false)[] = [
    {
      link: { id: "pulse", label: t("home.section.pulse") },
      eyebrow: t("home.eyebrow.pulse"),
      lead: t("home.lead.pulse"),
      body: (
        <GuildPulse chronicle={chronicle} memberCount={guild.memberCount} />
      ),
    },
    history !== undefined && {
      link: { id: "history", label: t("home.section.history") },
      eyebrow: t("home.eyebrow.history"),
      lead: t("home.lead.history"),
      body: <GuildHistory history={history} />,
    },
    chronicle.hallOfFame.length > 0 && {
      link: { id: "fame", label: t("home.section.fame") },
      eyebrow: t("home.eyebrow.fame"),
      lead: t("home.lead.fame"),
      body: <GuildHallOfFame hallOfFame={chronicle.hallOfFame} />,
    },
    {
      link: { id: "composition", label: t("home.section.composition") },
      eyebrow: t("home.eyebrow.composition"),
      body: <GuildComposition chronicle={chronicle} />,
    },
    chronicle.dossiers.length > 0 && {
      link: { id: "dossiers", label: t("home.section.dossiers") },
      eyebrow: t("home.eyebrow.dossiers"),
      lead: t("home.lead.dossiers"),
      body: <GuildDossiers dossiers={chronicle.dossiers} />,
    },
    {
      link: { id: "bestiary", label: t("home.section.bestiary") },
      eyebrow: t("home.eyebrow.bestiary"),
      lead: t("home.lead.bestiary"),
      body: <GuildBestiary bestiary={chronicle.bestiary} />,
    },
    {
      link: { id: "crafters", label: t("home.section.crafters") },
      eyebrow: t("home.eyebrow.crafters"),
      lead: t("home.lead.crafters"),
      body: <GuildCrafters professions={chronicle.professions} />,
    },
    {
      link: { id: "timeline", label: t("home.section.timeline") },
      eyebrow: t("home.eyebrow.timeline"),
      body: <GuildTimeline timeline={chronicle.timeline} />,
    },
  ];
  return sections.filter(
    (section): section is ChronicleSection => section !== false,
  );
};
