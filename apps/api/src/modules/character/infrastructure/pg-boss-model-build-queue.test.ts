import { describe, expect, it, vi } from "vitest";
import {
  CONVERT_QUEUE,
  LOOK_QUEUE,
  makeNoopModelBuildQueue,
  makePgBossModelBuildQueue,
} from "./pg-boss-model-build-queue.js";

describe("model build queue", () => {
  it("uses identity singleton keys and backs off failed bakes", async () => {
    const send = vi.fn().mockResolvedValue("1");
    const queue = makePgBossModelBuildQueue({ send } as never);
    await queue.enqueueLook({
      lookHash: "abc123",
      clientBuild: "1.60.1.70938",
      race: 1,
      sex: 0,
      classId: 1,
      customizations: [],
      items: [16820],
      equipmentOverrides: [],
      animationIds: [0],
    });
    await queue.enqueueConvert({
      build: "1.60.1.70938",
      outputVersion: 6,
      fileId: 123,
      kind: "model",
    });
    expect(send).toHaveBeenNthCalledWith(
      1,
      LOOK_QUEUE,
      expect.objectContaining({ lookHash: "abc123" }),
      expect.objectContaining({ singletonKey: "abc123", retryBackoff: true }),
    );
    expect(send).toHaveBeenNthCalledWith(
      2,
      CONVERT_QUEUE,
      expect.objectContaining({ fileId: 123 }),
      expect.objectContaining({
        singletonKey: "1.60.1.70938:6:123",
        retryBackoff: true,
      }),
    );
  });

  it("exposes a no-op queue for tests without Postgres", async () => {
    await expect(
      makeNoopModelBuildQueue().enqueueLook({
        lookHash: "abc",
        clientBuild: "wowf",
        race: 1,
        sex: 0,
        classId: 1,
        customizations: [],
        items: [],
        equipmentOverrides: [],
        animationIds: [],
      }),
    ).resolves.toBeUndefined();
  });
});
