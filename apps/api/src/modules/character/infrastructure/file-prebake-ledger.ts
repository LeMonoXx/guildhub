import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { PrebakeLedger, PrebakeRecord } from "../application/ports.js";

const recordSchema = z.object({
  races: z
    .object({
      build: z.string(),
      ids: z.array(z.number().int().positive()),
    })
    .optional(),
  completeBuild: z.string().optional(),
});

/** One JSON file; a missing or unreadable file means nothing is known yet. */
export function makeFilePrebakeLedger(file: string): PrebakeLedger {
  return {
    read: async (): Promise<PrebakeRecord> => {
      let text: string;
      try {
        text = await readFile(file, "utf8");
      } catch {
        return {};
      }
      try {
        const parsed = recordSchema.safeParse(JSON.parse(text));
        return parsed.success ? stripUndefined(parsed.data) : {};
      } catch {
        return {};
      }
    },
    write: async (record) => {
      await mkdir(path.dirname(file), { recursive: true });
      const temporary = `${file}.${String(process.pid)}.tmp`;
      await writeFile(temporary, JSON.stringify(record));
      await rename(temporary, file);
    },
  };
}

function stripUndefined(record: z.infer<typeof recordSchema>): PrebakeRecord {
  return {
    ...(record.races === undefined ? {} : { races: record.races }),
    ...(record.completeBuild === undefined
      ? {}
      : { completeBuild: record.completeBuild }),
  };
}
