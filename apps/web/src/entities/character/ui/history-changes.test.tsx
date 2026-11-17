/** @vitest-environment jsdom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { LocaleProvider } from "../../../shared/i18n";
import { HistoryChanges } from "./history-changes";
import { HistoryChecked } from "./history-checked";

afterEach(cleanup);

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
