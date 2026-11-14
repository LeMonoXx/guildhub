import { afterEach, describe, expect, it, vi } from "vitest";
import { makeHttpCharacterMediaGateway } from "./http-character-media-gateway.js";

const jpeg = () =>
  new Response(new Uint8Array([1, 2, 3]), {
    status: 200,
    headers: { "content-type": "image/jpeg" },
  });

describe("makeHttpCharacterMediaGateway", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to the next icon host when the first lacks the icon", async () => {
    const fetchMock = vi.fn((url: URL) =>
      Promise.resolve(
        url.href.startsWith("https://render.test/forever-eu/")
          ? new Response(null, { status: 403 })
          : jpeg(),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const gateway = makeHttpCharacterMediaGateway({
      iconBaseUrls: [
        "https://render.test/forever-eu",
        "https://render.test/eu",
      ],
    });

    const icon = await gateway.fetchIcon(132537);

    expect(icon?.contentType).toBe("image/jpeg");
    expect(fetchMock.mock.calls.map(([url]) => url.href)).toEqual([
      "https://render.test/forever-eu/icons/56/132537.jpg",
      "https://render.test/eu/icons/56/132537.jpg",
    ]);
  });

  it("returns undefined when no host has the icon", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 404 }))),
    );
    const gateway = makeHttpCharacterMediaGateway({
      iconBaseUrls: ["https://render.test/forever-eu"],
    });
    expect(await gateway.fetchIcon(1)).toBeUndefined();
  });
});
