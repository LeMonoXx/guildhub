const classIdPattern = /^[0-9]+$/;

export const wowClassColorVar = (classId: string): string =>
  classIdPattern.test(classId)
    ? `var(--class-${classId}, var(--color-ink))`
    : "var(--color-ink)";
