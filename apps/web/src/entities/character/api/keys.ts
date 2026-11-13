export const characterKeys = {
  all: ["character"] as const,
  detail: (slug: string) => [...characterKeys.all, "detail", slug] as const,
};
