import type { Logger } from "pino";

export interface ShutdownStep {
  readonly name: string;
  readonly run: () => Promise<void>;
  /** A failed required step makes the process exit with an error. */
  readonly required: boolean;
}

/** Runs every step in order, even after one failed; true when no required step failed. */
export async function runShutdownSteps(
  logger: Logger,
  steps: readonly ShutdownStep[],
): Promise<boolean> {
  let clean = true;
  for (const step of steps) {
    try {
      await step.run();
    } catch (error) {
      logger.error({ module: "lifecycle", err: error }, `${step.name} failed`);
      if (step.required) clean = false;
    }
  }
  return clean;
}

/** Calls `shutdown` once, on the first SIGTERM or SIGINT. */
export function onShutdownSignal(
  shutdown: (signal: NodeJS.Signals) => void,
): void {
  let started = false;
  const once = (signal: NodeJS.Signals): void => {
    if (started) return;
    started = true;
    shutdown(signal);
  };
  process.once("SIGTERM", once);
  process.once("SIGINT", once);
}
