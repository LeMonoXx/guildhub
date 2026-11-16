/** @vitest-environment jsdom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { LocaleProvider } from "../../../shared/i18n";
import { HistoryChanges } from "./history-changes";
import { HistoryChecked } from "./history-checked";

afterEach(cleanup);

const textOf = (recordedDays: number) =>
  render(
    <LocaleProvider>
      <HistoryChanges events={[]} recordedDays={recordedDays} />
    </LocaleProvider>,
  ).container.textContent;

describe("HistoryChanges", () => {
  test("promises changes from tomorrow only on the first recorded day", () => {
    expect(textOf(1)).toMatch(/next day/);
  });

  test("says nothing changed once a day can be compared", () => {
    expect(textOf(2)).toMatch(/Nothing has changed since yesterday/);
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
