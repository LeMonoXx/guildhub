import type {
  CharacterDetailResponse,
  CharacterHistoryResponse,
  CharacterProfileResponse,
} from "@guildhub/contracts";
import type { ReactNode } from "react";
import { wowClassColorVar } from "../../../entities/character";
import type { SectionLink } from "../../../shared/ui";
import { CharacterArmory } from "../../../widgets/character-armory";
import { CharacterAttributes } from "../../../widgets/character-attributes";
import { CharacterCollections } from "../../../widgets/character-collections";
import { CharacterDeeds } from "../../../widgets/character-deeds";
import { CharacterHistory } from "../../../widgets/character-history";
import { CharacterProfessions } from "../../../widgets/character-professions";
import { CharacterReputations } from "../../../widgets/character-reputations";
import { CharacterTalents } from "../../../widgets/character-talents";

export interface ProfileSection {
  readonly link: SectionLink;
  readonly eyebrow: string;
  readonly lead?: string;
  readonly body: ReactNode;
}

export const profileSections = (
  profile: CharacterProfileResponse,
  detail: CharacterDetailResponse,
  history: CharacterHistoryResponse | undefined,
  t: (key: string, values?: Record<string, string | number>) => string,
): ProfileSection[] => {
  const sections: (ProfileSection | false)[] = [
    {
      link: { id: "armory", label: t("character.section.armory") },
      eyebrow: t("character.eyebrow.armory"),
      lead: t("character.lead.armory"),
      body: <CharacterArmory items={profile.equipment} />,
    },
    profile.statistics !== undefined && {
      link: { id: "attributes", label: t("character.section.attributes") },
      eyebrow: t("character.eyebrow.attributes"),
      body: <CharacterAttributes statistics={profile.statistics} />,
    },
    profile.specializations.length > 0 && {
      link: { id: "talents", label: t("character.section.talents") },
      eyebrow: t("character.eyebrow.talents"),
      body: (
        <CharacterTalents
          specializations={profile.specializations}
          talentTrees={profile.talentTrees}
          classColor={wowClassColorVar(detail.classId)}
        />
      ),
    },
    profile.professions.length > 0 && {
      link: { id: "professions", label: t("character.section.professions") },
      eyebrow: t("character.eyebrow.professions"),
      body: <CharacterProfessions professions={profile.professions} />,
    },
    profile.reputations.length > 0 && {
      link: { id: "reputations", label: t("character.section.reputations") },
      eyebrow: t("character.eyebrow.reputations"),
      body: <CharacterReputations reputations={profile.reputations} />,
    },
    {
      link: { id: "deeds", label: t("character.section.deeds") },
      eyebrow: t("character.eyebrow.deeds"),
      body: <CharacterDeeds profile={profile} />,
    },
    history !== undefined && {
      link: { id: "history", label: t("character.section.history") },
      eyebrow: t("character.eyebrow.history"),
      lead: t("character.lead.history"),
      body: <CharacterHistory history={history} classId={detail.classId} />,
    },
    {
      link: { id: "collections", label: t("character.section.collections") },
      eyebrow: t("character.eyebrow.collections"),
      body: <CharacterCollections profile={profile} />,
    },
  ];
  return sections.filter(
    (section): section is ProfileSection => section !== false,
  );
};
