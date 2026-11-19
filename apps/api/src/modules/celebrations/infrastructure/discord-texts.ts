import type { ContentLocale } from "@guildhub/contracts";
import type { Celebration } from "../domain/celebration.js";

export interface CelebrationText {
  readonly title: string;
  readonly description: string;
}

type CelebrationOf<K extends Celebration["kind"]> = Extract<
  Celebration,
  { kind: K }
>;

type Texts = {
  readonly [K in Celebration["kind"]]: (
    celebration: CelebrationOf<K>,
  ) => CelebrationText;
};

const germanCraft: Readonly<Record<number, string>> = {
  150: "Die Gesellenzeit ist vorbei, jetzt geht es zum Experten.",
  225: "Experte gemeistert. Als Nächstes wartet der Fachmann.",
  300: "Höchste Stufe im Handwerk erreicht. Jetzt kommen die besten Rezepte!",
};

const englishCraft: Readonly<Record<number, string>> = {
  150: "Journeyman is done, on to Expert.",
  225: "Expert mastered. Artisan is next.",
  300: "The highest craft rank is reached. Time for the best recipes!",
};

const texts: Readonly<Record<ContentLocale, Texts>> = {
  de: {
    levelCap: ({ member, level }) => ({
      title: `${member.name} hat Stufe ${String(level)} erreicht!`,
      description: "Die Höchststufe ist geschafft. Die ganze Gilde gratuliert!",
    }),
    profession: ({ member, profession, milestone }) => ({
      title: `${member.name}: ${profession} auf ${String(milestone)}`,
      description:
        germanCraft[milestone] ?? "Ein neuer Meilenstein im Handwerk!",
    }),
    reputation: ({ member, faction, standing }) => ({
      title: `${member.name} ist jetzt ${standing}`,
      description: `Ruf bei ${faction}: ${standing}.`,
    }),
    achievements: ({ member, count }) => ({
      title: `${member.name} hat ${String(count)} Erfolge errungen`,
      description:
        "So viele auf einmal, dass Battle.net nicht alle einzeln nennt.",
    }),
    achievement: ({ member, achievement }) => ({
      title: `${member.name} hat einen Erfolg errungen`,
      description: `[${achievement}]`,
    }),
  },
  en: {
    levelCap: ({ member, level }) => ({
      title: `${member.name} reached level ${String(level)}!`,
      description: "The level cap is done. The whole guild cheers!",
    }),
    profession: ({ member, profession, milestone }) => ({
      title: `${member.name}: ${profession} at ${String(milestone)}`,
      description: englishCraft[milestone] ?? "A new crafting milestone!",
    }),
    reputation: ({ member, faction, standing }) => ({
      title: `${member.name} is now ${standing}`,
      description: `Reputation with ${faction}: ${standing}.`,
    }),
    achievements: ({ member, count }) => ({
      title: `${member.name} earned ${String(count)} achievements`,
      description: "So many at once that Battle.net does not name them all.",
    }),
    achievement: ({ member, achievement }) => ({
      title: `${member.name} earned an achievement`,
      description: `[${achievement}]`,
    }),
  },
};

export function celebrationText(
  celebration: Celebration,
  locale: ContentLocale,
): CelebrationText {
  const text = texts[locale][celebration.kind] as (
    celebration: Celebration,
  ) => CelebrationText;
  return text(celebration);
}
