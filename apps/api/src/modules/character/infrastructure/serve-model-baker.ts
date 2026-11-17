import type { BakeUpdate, ModelBaker } from "../application/ports.js";
import type { BakerProcess } from "./baker-process.js";

/** The baker's `serve` protocol behind the application's port; prebakes yield to looks. */
export function makeServeModelBaker(baker: BakerProcess): ModelBaker {
  return {
    bakeLook: async (look, onUpdate) => {
      let latest: BakeUpdate = { stage: "opening", fraction: 0 };
      const report = (update: BakeUpdate) => {
        latest = update;
        onUpdate(update);
      };
      await baker.run(
        { command: "look", look },
        {
          listener: {
            onStage: (stage) => {
              report({ ...latest, stage });
            },
            onProgress: (fraction) => {
              report({ stage: "baking", fraction });
            },
          },
        },
      );
    },
    bakeFile: async (job) => {
      await baker.run({
        command: "file",
        kind: job.kind,
        fileId: job.fileId,
        ...(job.modelFileId === undefined
          ? {}
          : { modelFileId: job.modelFileId }),
        ...(job.animationId === undefined
          ? {}
          : { animationId: job.animationId }),
      });
    },
    bakeFixedLook: async () => {
      await baker.run({ command: "fixed" });
    },
    bakeWorldMap: async () => {
      await baker.run({ command: "worldmap" }, { priority: "background" });
    },
    currentBuild: async () => {
      const result = await baker.run(
        { command: "build" },
        { priority: "background" },
      );
      if (typeof result.build !== "string")
        throw new Error("the baker reported no game build");
      return result.build;
    },
    prebakeBody: async (race, sex) => {
      const result = await baker.run(
        { command: "prebake", race, sex },
        { priority: "background" },
      );
      return { baked: result.skipped !== true };
    },
  };
}
