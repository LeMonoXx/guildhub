/** @vitest-environment jsdom */
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { LocaleProvider } from "../../../shared/i18n";
import { HistoryChanges } from "./history-changes";
import { HistoryChecked } from "./history-checked";

afterEach(cleanup);

/** Member names are links, so the timeline needs a router around it. */
const renderRouted = (ui: ReactNode) =>
  render(
    <RouterProvider
      router={createRouter({
        routeTree: createRootRoute({
          component: () => <LocaleProvider>{ui}</LocaleProvider>,
        }),
        history: createMemoryHistory(),
      })}
    />,
  );

const textOf = (recordedChecks: number) =>
  render(
    <LocaleProvider>
      <HistoryChanges events={[]} recordedChecks={recordedChecks} />
    </LocaleProvider>,
  ).container.textContent;

describe("HistoryChanges", () => {
  test("promises changes from the next hourly check while only the baseline exists", () => {
    expect(textOf(1)).toMatch(/next hourly check/);
  });

  test("says no visible change once checks can be compared", () => {
    expect(textOf(2)).toMatch(/No visible change/);
  });

  test("puts every member on a lane and opens the latest level-up with its cheer", async () => {
    const member = {
      slug: "aria",
      name: "Aria",
      surname: "Storm",
      classId: "8",
    };
    const { container } = renderRouted(
      <HistoryChanges
        events={[
          {
            ...member,
            day: "2026-11-17",
            at: "2026-11-17T09:00:00Z",
            kind: "level",
            from: 41,
            to: 42,
          },
        ]}
        achievements={[
          { ...member, title: "Into the Wild", at: "2026-11-17T10:30:00Z" },
        ]}
        recordedChecks={3}
        renderCelebration={(event) => (
          <span className="cheer">{event.name}</span>
        )}
      />,
    );
    await waitFor(() => {
      expect(container.querySelector(".lanes")).not.toBeNull();
    });
    expect(container.querySelectorAll(".lane")).toHaveLength(1);
    const kinds = [...container.querySelectorAll(".lane-mark")].map((mark) =>
      mark.getAttribute("data-kind"),
    );
    expect(kinds).toEqual(["level", "achievement"]);
    expect(
      container.querySelector(".lane-mark[aria-pressed='true']")?.textContent,
    ).toBe("42");
    expect(container.querySelector(".lane-detail .cheer")?.textContent).toBe(
      "Aria",
    );
  });
});

describe("HistoryChecked", () => {
  test("shows when the hourly recording last ran", () => {
    const checkedAt = new Date(Date.now() - 5 * 60_000).toISOString();
    const { container } = render(
      <LocaleProvider>
        <HistoryChecked checkedAt={checkedAt} />
      </LocaleProvider>,
    );
    expect(container.textContent).toMatch(/Last checked 5 minutes ago/);
  });
});
