import { spawn } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { BakerProcess } from "./baker-process.js";

/** Answers like the real serve command; race 0 fails, race -1 crashes. */
const fakeBaker = `
const rl = require("node:readline").createInterface({ input: process.stdin });
const say = (m) => process.stdout.write(JSON.stringify(m) + "\\n");
say({ event: "ready" });
console.log("not json, like a TACTSharp retry");
rl.on("line", (line) => {
  const r = JSON.parse(line);
  if (r.race === -1) process.exit(3);
  if (r.race === 0) return say({ id: r.id, event: "failed", message: "no body" });
  say({ id: r.id, event: "stage", stage: "baking" });
  say({ id: r.id, event: "progress", fraction: 0.5 });
  say({ id: r.id, event: "done", result: { pid: process.pid, race: r.race } });
});
`;

const bakers: BakerProcess[] = [];

function makeBaker(idleMs = 5_000) {
  const logged: string[] = [];
  const baker = new BakerProcess({
    command: process.execPath,
    args: ["-e", fakeBaker],
    idleMs,
    log: (line) => logged.push(line),
    spawnBaker: (command, args) =>
      spawn(command, [...args], { stdio: ["pipe", "pipe", "pipe"] }),
  });
  bakers.push(baker);
  return { baker, logged };
}

const prebake = (race: number) =>
  ({ command: "prebake", race, sex: 0 }) as const;

afterEach(() => {
  for (const baker of bakers.splice(0)) baker.stop();
});

describe("BakerProcess", () => {
  it("runs requests through one process and reports progress", async () => {
    const { baker, logged } = makeBaker();
    const seen: number[] = [];
    const first = await baker.run(prebake(1), {
      listener: { onProgress: (fraction) => seen.push(fraction) },
    });
    const second = await baker.run(prebake(2));

    expect(seen).toEqual([0.5]);
    expect(second.pid).toBe(first.pid);
    expect(logged).toContain("not json, like a TACTSharp retry");
  });

  it("serves foreground requests before queued background work", async () => {
    const { baker } = makeBaker();
    const order: number[] = [];
    const track = (race: number, priority: "foreground" | "background") =>
      baker.run(prebake(race), { priority }).then(() => order.push(race));

    await Promise.all([
      track(1, "background"),
      track(2, "background"),
      track(3, "foreground"),
    ]);

    expect(order).toEqual([1, 3, 2]);
  });

  it("rejects a failed request and keeps serving", async () => {
    const { baker } = makeBaker();
    await expect(baker.run(prebake(0))).rejects.toThrow("no body");
    await expect(baker.run(prebake(4))).resolves.toMatchObject({ race: 4 });
  });

  it("starts a new process after a crash", async () => {
    const { baker } = makeBaker();
    const before = await baker.run(prebake(1));
    await expect(baker.run(prebake(-1))).rejects.toThrow("code 3");
    const after = await baker.run(prebake(2));
    expect(after.pid).not.toBe(before.pid);
  });

  it("refuses work once stopped, so a shutdown cannot start a new baker", async () => {
    const { baker } = makeBaker();
    await baker.run(prebake(1));
    baker.stop();
    await expect(baker.run(prebake(2))).rejects.toThrow("baker stopped");
  });

  it("lets an idle process go and starts again on demand", async () => {
    const { baker } = makeBaker(50);
    const before = await baker.run(prebake(1));
    await new Promise((resolve) => setTimeout(resolve, 300));
    const after = await baker.run(prebake(2));
    expect(after.pid).not.toBe(before.pid);
  });
});
