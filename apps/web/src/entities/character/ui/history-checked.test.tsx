/** @vitest-environment jsdom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { LocaleProvider } from "../../../shared/i18n";
import { HistoryChecked } from "./history-checked";

afterEach(cleanup);

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
