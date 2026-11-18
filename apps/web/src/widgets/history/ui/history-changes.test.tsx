/** @vitest-environment jsdom */
import type { HistoryEvent } from "@guildhub/contracts";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { LocaleProvider } from "../../../shared/i18n";
import { HistoryChanges } from "./history-changes";

afterEach(cleanup);

/** Member names are links, so the timeline needs a router around it. */
const renderRouted = async (ui: ReactNode) => {
  const view = render(
    <RouterProvider
      router={createRouter({
        routeTree: createRootRoute({
          component: () => <LocaleProvider>{ui}</LocaleProvider>,
        }),
        history: createMemoryHistory(),
      })}
    />,
  );
  await waitFor(() => {
    expect(view.container.querySelector(".lanes")).not.toBeNull();
  });
  return view.container;
};

const textOf = (recordedChecks: number) =>
  render(
    <LocaleProvider>
      <HistoryChanges events={[]} recordedChecks={recordedChecks} />
    </LocaleProvider>,
  ).container.textContent;

const aria = { slug: "aria", name: "Aria", surname: "Storm", classId: "8" };
const bram = { slug: "bram", name: "Bram", surname: "Oak", classId: "1" };

const levelUp: HistoryEvent = {
  ...aria,
  day: "2026-11-17",
  at: "2026-11-17T09:00:00Z",
  kind: "level",
  from: 41,
  to: 42,
};
const explored: HistoryEvent = {
  ...aria,
  day: "2026-11-17",
  at: "2026-11-17T10:30:00Z",
  kind: "achievement",
  achievementId: 7,
  achievement: "Into the Wild",
};
const quested: HistoryEvent = {
  ...bram,
  day: "2026-11-17",
  at: "2026-11-17T11:00:00Z",
  kind: "quests",
  from: 3,
  to: 5,
};

const pressed = (container: HTMLElement) =>
  container.querySelector<HTMLElement>(".lane-mark[aria-pressed='true']");
const detailText = (container: HTMLElement) =>
  container.querySelector(".lane-detail")?.textContent ?? "";

describe("HistoryChanges", () => {
  test("promises changes from the next hourly check while only the baseline exists", () => {
    expect(textOf(1)).toMatch(/next hourly check/);
  });

  test("says no visible change once checks can be compared", () => {
    expect(textOf(2)).toMatch(/No visible change/);
  });

  test("puts every member on a lane and opens the latest level-up with its cheer", async () => {
    const container = await renderRouted(
      <HistoryChanges
        events={[levelUp, explored]}
        recordedChecks={3}
        renderCelebration={(event) => (
          <span className="cheer">{event.name}</span>
        )}
      />,
    );
    expect(container.querySelectorAll(".lane")).toHaveLength(1);
    const kinds = [...container.querySelectorAll(".lane-mark")].map((mark) =>
      mark.getAttribute("data-kind"),
    );
    expect(kinds).toEqual(["level", "achievement"]);
    expect(pressed(container)?.textContent).toBe("42");
    expect(container.querySelector(".lane-detail .cheer")?.textContent).toBe(
      "Aria",
    );
  });

  test("previews a mark while pointed at and keeps the one pressed", async () => {
    const container = await renderRouted(
      <HistoryChanges events={[levelUp, explored]} recordedChecks={3} />,
    );
    const trophy = screen.getByRole("button", { name: /Into the Wild/ });
    fireEvent.mouseEnter(trophy);
    expect(detailText(container)).toMatch(/Into the Wild/);
    fireEvent.mouseLeave(screen.getByRole("toolbar"));
    expect(detailText(container)).not.toMatch(/Into the Wild/);
    fireEvent.click(trophy);
    fireEvent.mouseLeave(screen.getByRole("toolbar"));
    expect(detailText(container)).toMatch(/Into the Wild/);
  });

  test("moves between marks and lanes with the arrow keys from a single tab stop", async () => {
    const container = await renderRouted(
      <HistoryChanges
        events={[levelUp, explored, quested]}
        recordedChecks={3}
      />,
    );
    const stops = container.querySelectorAll(".lane-mark[tabindex='0']");
    expect(stops).toHaveLength(1);
    const level = stops[0] as HTMLElement;
    level.focus();
    fireEvent.keyDown(level, { key: "ArrowRight" });
    expect(document.activeElement?.getAttribute("data-kind")).toBe(
      "achievement",
    );
    expect(detailText(container)).toMatch(/Into the Wild/);
    fireEvent.keyDown(document.activeElement as HTMLElement, {
      key: "ArrowUp",
    });
    expect(document.activeElement?.getAttribute("data-kind")).toBe("quests");
  });
});
