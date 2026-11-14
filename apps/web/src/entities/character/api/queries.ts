import { characterKeys } from "./keys";
import type { CharacterDataSource } from "./source";

export const characterQueries = (source: CharacterDataSource) => ({
  detail: (slug: string) => ({
    queryKey: characterKeys.detail(slug),
    queryFn: () => source.getBySlug(slug),
  }),
  profile: (slug: string) => ({
    queryKey: characterKeys.profile(slug),
    queryFn: () => source.getProfile(slug),
    staleTime: 5 * 60_000,
  }),
  history: (slug: string) => ({
    queryKey: characterKeys.history(slug),
    queryFn: () => source.getHistory(slug),
    staleTime: 10 * 60_000,
  }),
});
