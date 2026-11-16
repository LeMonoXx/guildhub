import { describe, expect, test, vi } from "vitest";
import type { CinematicTimeline } from "../../../shared/cinematic";
import { evaluateMotionFrame } from "./cinematic-playback";

describe("reduced motion", () => {
  test("selects the deterministic poster without advancing playback", () => {
    const poster = vi.fn(() => ({ timeMs: 600 }));
    const evaluate = vi.fn(() => ({ timeMs: 200 }));
    const timeline = {
      poster,
      evaluate,
      clock: { time: { elapsedMs: 200 } },
    } as unknown as CinematicTimeline;

    expect(evaluateMotionFrame(timeline, true, 600)).toEqual({ timeMs: 600 });
    expect(poster).toHaveBeenCalledWith(600);
    expect(evaluate).not.toHaveBeenCalled();
  });

  test("uses the current absolute frame for normal motion", () => {
    const poster = vi.fn();
    const evaluate = vi.fn(() => ({ timeMs: 200 }));
    const timeline = {
      poster,
      evaluate,
      clock: { time: { elapsedMs: 200 } },
    } as unknown as CinematicTimeline;

    expect(evaluateMotionFrame(timeline, false)).toEqual({ timeMs: 200 });
    expect(evaluate).toHaveBeenCalledWith(200);
    expect(poster).not.toHaveBeenCalled();
  });

  test("uses an explicit preview frame without advancing playback", () => {
    const poster = vi.fn(() => ({ timeMs: 6100 }));
    const evaluate = vi.fn();
    const timeline = {
      poster,
      evaluate,
      clock: { time: { elapsedMs: 200 } },
    } as unknown as CinematicTimeline;

    expect(evaluateMotionFrame(timeline, false, undefined, 6100)).toEqual({
      timeMs: 6100,
    });
    expect(poster).toHaveBeenCalledWith(6100);
    expect(evaluate).not.toHaveBeenCalled();
  });
});
