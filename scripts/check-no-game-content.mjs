/* global console, process */
import { execFileSync } from "node:child_process";
import { findViolations } from "./no-game-content-rules.mjs";

const tracked = execFileSync("git", ["ls-files", "-z"], {
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);

const violations = findViolations(tracked);

if (violations.length > 0) {
  console.error("Tracked generated or Blizzard game content is not allowed:");
  for (const { path, reason } of violations)
    console.error(`  ${path} (${reason})`);
  console.error(
    "Vendored Definitions/*.dbd and authored source/documentation assets remain allowed.",
  );
  process.exit(1);
}

console.log(`No tracked game content found (${tracked.length} files checked).`);
