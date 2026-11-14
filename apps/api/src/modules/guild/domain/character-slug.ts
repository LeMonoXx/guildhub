const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugifyCharacterPart(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replaceAll(/\p{M}/gu, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
  return fitSlug(slug);
}

export function assignCharacterSlug(
  name: string,
  surname: string,
  characterId: string,
): string {
  const fromNames = slugifyCharacterPart(`${name}-${surname}`);
  if (fromNames.length > 0 && slugPattern.test(fromNames)) return fromNames;
  const fallback = slugifyCharacterPart(`c${characterId}`);
  return fallback.length > 0 ? fallback : "c";
}

export function uniquifySlugs<T extends { readonly slug: string }>(
  members: readonly T[],
): T[] {
  const seen = new Map<string, number>();
  return members.map((member) => {
    const count = seen.get(member.slug) ?? 0;
    seen.set(member.slug, count + 1);
    if (count === 0) return member;
    const suffix = `-${slugifyCharacterPart(String(count + 1))}`;
    return { ...member, slug: fitSlug(`${member.slug}${suffix}`) };
  });
}

function fitSlug(value: string): string {
  return value.slice(0, 64).replaceAll(/-+$/g, "");
}
