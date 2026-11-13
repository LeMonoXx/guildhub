import { characterKeys } from "./keys";
import type { CharacterDataSource } from "./source";

export const characterQueries = (source: CharacterDataSource) => ({
  detail: (slug: string) => ({
    queryKey: characterKeys.detail(slug),
    queryFn: () => source.getBySlug(slug),
  }),
});
