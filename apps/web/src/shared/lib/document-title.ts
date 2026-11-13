export const formatDocumentTitle = (
  page: string,
  guildName?: string,
): string => (guildName ? `${page} · ${guildName}` : page);
