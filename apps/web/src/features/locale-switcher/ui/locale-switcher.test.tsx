/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { LocaleProvider } from "../../../shared/i18n";
import { LocaleSwitcher } from "./locale-switcher";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("LocaleSwitcher", () => {
  test("switches visible copy between English and German", async () => {
    const user = userEvent.setup();
    localStorage.setItem("guildhub.locale", "en");
    render(
      <LocaleProvider>
        <LocaleSwitcher />
      </LocaleProvider>,
    );
    expect(screen.getByLabelText("Language")).toBeTruthy();
    await user.selectOptions(screen.getByLabelText("Language"), "de");
    expect(screen.getByLabelText("Sprache")).toBeTruthy();
  });
});
