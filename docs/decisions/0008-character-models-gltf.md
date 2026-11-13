# 0008. Character models as cached glTF

- Status: Accepted
- Date: 2026-11-13

## Context

The guild page should show members as animated characters wearing their real gear. The Battle.net API returns item IDs and an official still render, not a model. wowmodelviewer is a Windows desktop app (GPL-3.0) and cannot be ported or run as a sidecar to get a model into the browser.

The conversion we would design already exists. [Altrobe](https://github.com/Cloudmancermedia/altrobe) bakes Forever game files from Blizzard's CDN into glTF and PNG and renders them with React and Three.js, with no game running. It is a dressing room: it does not read a real character from the Armory.

## Decision

Bake Forever game data into glTF and PNG off the request, serve them as immutable cached files, and play them with Three.js on the character page only. The browser composites the body texture from cached layers. The official render image is the fallback and the roster image. A look hash joins a character's Battle.net appearance and gear to those files, so a visit never waits on a build.

Game bytes are not committed and not fetched live by the browser. The baker reads Blizzard's CDN once per build and writes our asset store. Table definitions from WoWDBDefs are community format files and may be vendored. The rule and the file list are in the [plan](../architecture/character-rendering-plan.md).

The pipeline and the budgets are in [character rendering](../architecture/character-rendering.md).

## Consequences

- We copy Altrobe's converter and viewer instead of rewriting them. The part that is ours is the Armory join and a bake scoped to the guild.
- The baker is .NET, in its own image. The API stays TypeScript, fast, and read-only.
- Game files and baked assets stay out of git. Serving them is the owner's call before production (character rendering §12).
