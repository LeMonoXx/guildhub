const GIVE_UP_MS = 120_000;

export function modelPollInterval(
  status: string | undefined,
  elapsedMs: number,
): number | false {
  if (status !== "pending") return false;
  if (elapsedMs >= GIVE_UP_MS) return false;
  if (elapsedMs < 2_000) return 2_000;
  if (elapsedMs < 6_000) return 4_000;
  if (elapsedMs < 14_000) return 8_000;
  return 15_000;
}
