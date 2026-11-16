import type { FrameCommand } from "./evaluators.js";
import type { CinematicFrame } from "./timeline.js";

/**
 * Adjusts an evaluated frame before it reaches the bindings, for live
 * behavior an authored timeline cannot know about, like reacting to input.
 * Implementations must be pure with respect to the frame they receive.
 */
export interface FrameDecorator {
  decorate(frame: CinematicFrame): CinematicFrame;
}

/** Runs decorators in order; each sees the previous one's result. */
export const decorateFrame = (
  frame: CinematicFrame,
  decorators: readonly FrameDecorator[],
): CinematicFrame =>
  decorators.reduce((current, decorator) => decorator.decorate(current), frame);

/** A copy of `frame` whose commands went through `replace`. */
export const mapCommands = (
  frame: CinematicFrame,
  replace: (command: FrameCommand) => FrameCommand,
): CinematicFrame => ({ ...frame, commands: frame.commands.map(replace) });
