import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";

export type BakerRequest =
  | { readonly command: "look"; readonly look: unknown }
  | { readonly command: "fixed" }
  | {
      readonly command: "file";
      readonly kind: string;
      readonly fileId: number;
      readonly modelFileId?: number;
      readonly animationId?: number;
    }
  | { readonly command: "prebake"; readonly race: number; readonly sex: number }
  | { readonly command: "build" };

export type BakerStage = "opening" | "baking";

export interface BakerListener {
  onStage?(stage: BakerStage): void;
  onProgress?(fraction: number): void;
}

/** Background work waits while any foreground request is queued. */
export type BakerPriority = "foreground" | "background";

export interface BakerProcessOptions {
  readonly command: string;
  readonly args: readonly string[];
  /** How long a baker with nothing to do keeps its game storage open. */
  readonly idleMs: number;
  readonly log: (line: string) => void;
  readonly spawnBaker?: (
    command: string,
    args: readonly string[],
  ) => ChildProcessWithoutNullStreams;
}

interface Pending {
  readonly id: string;
  readonly request: BakerRequest;
  readonly listener: BakerListener;
  readonly resolve: (result: Record<string, unknown>) => void;
  readonly reject: (error: Error) => void;
}

interface Running {
  readonly child: ChildProcessWithoutNullStreams;
  ready: boolean;
}

/**
 * Keeps one baker process for a run of requests, so only the first one pays for
 * opening Blizzard's CDN indexes and tables. The process exits once it has been
 * idle for `idleMs`, which gives its memory back between runs.
 */
export class BakerProcess {
  private readonly foreground: Pending[] = [];
  private readonly background: Pending[] = [];
  private current: Pending | undefined;
  private running: Running | undefined;
  private idleTimer: NodeJS.Timeout | undefined;
  private nextId = 1;

  constructor(private readonly options: BakerProcessOptions) {}

  run(
    request: BakerRequest,
    options: { priority?: BakerPriority; listener?: BakerListener } = {},
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const pending: Pending = {
        id: String(this.nextId++),
        request,
        listener: options.listener ?? {},
        resolve,
        reject,
      };
      (options.priority === "background"
        ? this.background
        : this.foreground
      ).push(pending);
      this.pump();
    });
  }

  /** Ends the process; queued requests fail. */
  stop(): void {
    clearTimeout(this.idleTimer);
    const error = new Error("baker stopped");
    for (const pending of this.foreground.splice(0)) pending.reject(error);
    for (const pending of this.background.splice(0)) pending.reject(error);
    this.running?.child.kill();
  }

  private pump(): void {
    if (this.current !== undefined) return;
    const next = this.foreground.shift() ?? this.background.shift();
    if (next === undefined) {
      this.scheduleIdleExit();
      return;
    }
    clearTimeout(this.idleTimer);
    this.current = next;
    const running = this.running ?? this.start();
    if (running.ready) this.send(running, next);
  }

  private start(): Running {
    const spawnBaker =
      this.options.spawnBaker ??
      ((command: string, args: readonly string[]) =>
        spawn(command, [...args], { stdio: ["pipe", "pipe", "pipe"] }));
    const child = spawnBaker(this.options.command, this.options.args);
    const running: Running = { child, ready: false };
    this.running = running;
    child.stderr.on("data", (chunk: Buffer) => {
      process.stderr.write(chunk);
    });
    // A baker that died mid-write is reported by its exit event.
    child.stdin.on("error", () => undefined);
    createInterface({ input: child.stdout }).on("line", (line) => {
      this.onLine(running, line);
    });
    child.on("error", (error) => {
      this.onExit(running, error);
    });
    child.on("exit", (code, signal) => {
      this.onExit(
        running,
        new Error(
          `baker exited (${signal ?? `code ${String(code ?? "unknown")}`})`,
        ),
      );
    });
    return running;
  }

  private send(running: Running, pending: Pending): void {
    running.child.stdin.write(
      `${JSON.stringify({ id: pending.id, ...pending.request })}\n`,
    );
  }

  private onLine(running: Running, line: string): void {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(line) as Record<string, unknown>;
    } catch {
      this.options.log(line);
      return;
    }
    if (message.event === "ready") {
      running.ready = true;
      if (this.current !== undefined) this.send(running, this.current);
      return;
    }
    const pending = this.current;
    if (pending === undefined || message.id !== pending.id) return;
    if (message.event === "stage") {
      pending.listener.onStage?.(message.stage as BakerStage);
    } else if (message.event === "progress") {
      if (typeof message.fraction === "number")
        pending.listener.onProgress?.(message.fraction);
    } else if (message.event === "done") {
      this.current = undefined;
      pending.resolve((message.result ?? {}) as Record<string, unknown>);
      this.pump();
    } else if (message.event === "failed") {
      this.current = undefined;
      pending.reject(
        new Error(
          typeof message.message === "string" ? message.message : "bake failed",
        ),
      );
      this.pump();
    }
  }

  private onExit(running: Running, error: Error): void {
    if (this.running !== running) return;
    this.running = undefined;
    const pending = this.current;
    this.current = undefined;
    pending?.reject(error);
    this.pump();
  }

  private scheduleIdleExit(): void {
    if (this.running === undefined) return;
    clearTimeout(this.idleTimer);
    const running = this.running;
    this.idleTimer = setTimeout(() => {
      if (this.running !== running || this.current !== undefined) return;
      this.running = undefined;
      running.child.stdin.end();
    }, this.options.idleMs);
  }
}
