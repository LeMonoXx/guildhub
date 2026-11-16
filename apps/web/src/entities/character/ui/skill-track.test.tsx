/** @vitest-environment jsdom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { LocaleProvider } from "../../../shared/i18n";
import { SkillScale } from "./skill-scale";
import { SkillTrack } from "./skill-track";

afterEach(cleanup);

const renderTrack = (skill: number, maxSkill: number) =>
  render(
    <LocaleProvider>
      <SkillScale />
      <SkillTrack skill={skill} maxSkill={maxSkill} label="Skinning" />
    </LocaleProvider>,
  ).container;

const percentOf = (value: string) => Number.parseFloat(value);

describe("SkillTrack", () => {
  test("puts the scale's marks exactly where the bar's ticks are", () => {
    const container = renderTrack(147, 150);
    const scale = [
      ...container.querySelectorAll<HTMLElement>(".skill-scale span"),
    ]
      .slice(0, -1)
      .map((mark) => mark.style.left);
    const ticks = [
      ...container.querySelectorAll<HTMLElement>(".skill-track-tick"),
    ].map((tick) => tick.style.left);
    expect(ticks).toEqual(scale);
    expect(scale.map(percentOf)).toEqual([25, 50, 75]);
  });

  test("fills short of the cap when the skill is below it", () => {
    const track = renderTrack(147, 150).querySelector<HTMLElement>(
      ".skill-track",
    );
    const fill = Number(track?.style.getPropertyValue("--skill-fill"));
    const cap = Number(track?.style.getPropertyValue("--skill-unlocked"));
    expect(fill).toBeCloseTo(0.49);
    expect(cap).toBeCloseTo(0.5);
    expect(fill).toBeLessThan(cap);
  });
});
