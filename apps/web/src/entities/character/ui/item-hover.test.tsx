/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "../../../shared/i18n";
import { fixtureItem } from "../api/item-fixtures";
import { ItemHover } from "./item-hover";

const originalFetch = globalThis.fetch;

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

const known = {
  ...fixtureItem(16_866),
  stats: [],
  armor: undefined,
  sellPriceCopper: undefined,
};

function renderHover() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <LocaleProvider>
        <ItemHover item={known}>
          <span>[Helm of Wrath]</span>
        </ItemHover>
      </LocaleProvider>
    </QueryClientProvider>,
  );
}

describe("ItemHover", () => {
  test("asks for the full tooltip only once the item is hovered", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(fixtureItem(16_866)), { status: 200 }),
      );
    globalThis.fetch = fetch;
    renderHover();
    expect(screen.getByRole("tooltip", { hidden: true }).textContent).toMatch(
      /Helm of Wrath/,
    );
    expect(fetch).not.toHaveBeenCalled();

    fireEvent.pointerEnter(screen.getByText("[Helm of Wrath]"));
    expect(await screen.findByText("+40 Stamina")).toBeTruthy();
    expect(String(fetch.mock.calls[0]?.[0])).toContain("/api/items/16866");
  });
});
