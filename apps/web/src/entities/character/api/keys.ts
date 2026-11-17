export const characterKeys = {
  all: ["character"] as const,
  detail: (slug: string) => [...characterKeys.all, "detail", slug] as const,
  profile: (slug: string) => [...characterKeys.all, "profile", slug] as const,
  history: (slug: string) => [...characterKeys.all, "history", slug] as const,
  item: (itemId: number) => [...characterKeys.all, "item", itemId] as const,
};
