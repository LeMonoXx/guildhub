import { describe, expect, test, vi } from "vitest";
import { assetUrl, loadFixedLook } from "./manifest";

describe("fixed-look manifest", () => {
  test("keeps asset paths below the same-origin assets root", () => {
    expect(assetUrl("/builds/test/model.gltf")).toBe(
      "/assets/builds/test/model.gltf",
    );
  });

  test("follows current.json to the fixed look", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ fixedLook: "looks/fixed/look.json" })),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            schemaVersion: 1,
            body: { path: "body.gltf", fileDataId: 1 },
            bodyMetadata: "body.json",
            items: [],
          }),
        ),
      );
    await expect(loadFixedLook(fetcher)).resolves.toMatchObject({
      schemaVersion: 1,
    });
    expect(fetcher).toHaveBeenNthCalledWith(2, "/assets/looks/fixed/look.json");
  });
});
