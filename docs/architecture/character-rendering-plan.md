# Character rendering plan

The implementation plan for animated characters. The target behaviour is [character rendering](character-rendering.md). This file says which existing code to take, which to leave, and in what order. It is written for the agent that builds it.

Reviewed against Altrobe commit [`b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7`](https://github.com/Cloudmancermedia/altrobe/commit/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7) (2026-11-12). Links below point at that commit. Read the file at that commit, not at `main`, which will have moved.

## 1. Decision: game files are baked, never committed, never live

Three ways to get a model into the browser. We take the third.

| Way                                                                                                                     | What happens                                             | Verdict                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Commit the extracted glTF and PNG into this repo and ship them from git                                                 | Versioned, no fetch from Blizzard at runtime             | No. The bytes are Blizzard's models and textures. They do not belong in git history, in CI, or in every clone. A full bake is far too big for a source repo. |
| Browser or API fetches Blizzard's CDN on each visit                                                                     | Nothing stored                                           | No. The browser would need an M2 parser, Blizzard's CDN is not our cache, and a visitor would wait on it.                                                    |
| Baker reads Blizzard's CDN once per Forever build, writes glTF and PNG into our asset store, the site serves only those | Versioned by build and converter version, immutable URLs | Yes.                                                                                                                                                         |

Altrobe made the same call and enforces it. [`scripts/check-no-game-content.mjs`](https://github.com/Cloudmancermedia/altrobe/blob/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7/scripts/check-no-game-content.mjs) fails the build when a tracked file looks like game content. Their [AGENTS.md](https://github.com/Cloudmancermedia/altrobe/blob/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7/AGENTS.md) states the rule. We add the same check in the phase that introduces the baker.

What we do commit:

- Our code.
- Pinned table definitions (`.dbd`). Those are community format descriptions from [WoWDBDefs](https://github.com/wowdev/WoWDBDefs), CC BY-SA 4.0, not Blizzard content. Altrobe vendors them at WoWDBDefs commit `12ce70d5fef13370f0edf08889f01c05321d2e28` and says so in [`importer/src/Altrobe.Core/Definitions/README.md`](https://github.com/Cloudmancermedia/altrobe/blob/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7/importer/src/Altrobe.Core/Definitions/README.md). Keep that notice. Do not relicense those files as ours. When a vendored definition lacks the build being read, download the current definition into the cache, as Altrobe does. Do not commit the download.

The asset store is rebuildable. It is not backed up as source of truth. Postgres holds the look and the list of file IDs, not the bytes.

Serving the baked files from our server is still Blizzard's art. [Character rendering §12](character-rendering.md) stands: the owner decides that before the baker runs in production.

## 2. What Altrobe actually is

A dressing room, not an armory. You pick a race and items. Nothing reads the Battle.net API. There is no `armory`, `character-appearance`, or `battlenet` anywhere in the repo.

```text
game files → Altrobe.Core (.NET 10) → glTF + PNG + JSON → React 19 + three.js
```

Two fronts, one converter:

- **Local.** [`Altrobe.Server`](https://github.com/Cloudmancermedia/altrobe/tree/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7/importer/src/Altrobe.Server) reads a Forever install and converts a file the first time the page asks for it.
- **Hosted.** [`BundleBaker`](https://github.com/Cloudmancermedia/altrobe/blob/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7/importer/src/Altrobe.Core/Hosted/BundleBaker.cs) reads one build from Blizzard's CDN through TACTSharp and writes a static bundle. [`docs/hosted-pipeline.md`](https://github.com/Cloudmancermedia/altrobe/blob/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7/docs/hosted-pipeline.md) describes it. `current.json` moves to the new build only after a count check (`MaxDrop`, default 5 percent). A failed bake keeps the previous build.

The browser never parses M2. It composites the body texture itself from PNG layers. That is the important correction to an earlier draft of our design, which baked one skin image per look on the server. Altrobe's way is the one we use: the expensive bytes are shared, and a look is a small description.

Stack they use, and whether we follow:

| Their choice                                    | Where                                                                                                                                                            | Ours                                                                                    |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| .NET 10, DBCD 2.3.1, TACTSharp 0.2.0-alpha      | [`Altrobe.Core.csproj`](https://github.com/Cloudmancermedia/altrobe/blob/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7/importer/src/Altrobe.Core/Altrobe.Core.csproj) | Keep, inside the baker only. Do not translate `ModelConverter` to TypeScript.           |
| React 19, Vite, Three.js                        | [`web/package.json`](https://github.com/Cloudmancermedia/altrobe/blob/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7/web/package.json)                                 | Already our stack. Copy the viewer, not their app shell.                                |
| npm, oxlint, TypeScript 7, Node 20              | web app                                                                                                                                                          | No. pnpm, our ESLint, TypeScript 6 (typescript-eslint does not support 7 yet), Node 24. |
| AWS CDK, CloudFront, a prompt Lambda, Turnstile | `infra/`                                                                                                                                                         | No. Our host is Docker Compose and Caddy.                                               |
| An AI dresser, MCP, a desktop extension         | `Altrobe.Server`, `desktop-extension/`                                                                                                                           | No.                                                                                     |

## 3. Copy

Copy means: bring the code across, keep the licence header, keep the wow.export attribution those files already carry, and change only what the guild site needs. Altrobe is MIT. wow.export, which Altrobe ports from, is MIT. Both notices stay in the files.

### 3.1 The converter (do not rewrite)

| File                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | What it does                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`Convert/AssetConverter.cs`](https://github.com/Cloudmancermedia/altrobe/blob/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7/importer/src/Altrobe.Core/Convert/AssetConverter.cs)                                                                                                                                                                                                                                                                                                               | Public entry. `OutputVersion` (now 3) is part of the URL, so a converter change publishes new files beside the old ones and the year-long cache stays valid. Bump it when output bytes change. |
| [`Convert/M2Model.cs`](https://github.com/Cloudmancermedia/altrobe/blob/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7/importer/src/Altrobe.Core/Convert/M2Model.cs), [`M2Anim.cs`](https://github.com/Cloudmancermedia/altrobe/blob/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7/importer/src/Altrobe.Core/Convert/M2Anim.cs), [`ModelConverter.cs`](https://github.com/Cloudmancermedia/altrobe/blob/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7/importer/src/Altrobe.Core/Convert/ModelConverter.cs) | M2 plus skin to a `.glb` and a metadata JSON (geosets, texture slots, attachment points, sequence IDs, particles). One animation to its own `.glb`.                                            |
| [`Convert/Blp.cs`](https://github.com/Cloudmancermedia/altrobe/blob/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7/importer/src/Altrobe.Core/Convert/Blp.cs), [`Png.cs`](https://github.com/Cloudmancermedia/altrobe/blob/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7/importer/src/Altrobe.Core/Convert/Png.cs)                                                                                                                                                                                     | BLP to PNG. We keep PNG. Do not switch to WebP. Their compositor and materials assume PNG.                                                                                                     |
| [`Storage/CdnSource.cs`](https://github.com/Cloudmancermedia/altrobe/blob/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7/importer/src/Altrobe.Core/Storage/CdnSource.cs), [`GameStorage.cs`](https://github.com/Cloudmancermedia/altrobe/blob/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7/importer/src/Altrobe.Core/Storage/GameStorage.cs)                                                                                                                                                         | Read product `wowf` from Blizzard's CDN. No install, no running game.                                                                                                                          |
| [`Tables/`](https://github.com/Cloudmancermedia/altrobe/tree/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7/importer/src/Altrobe.Core/Tables)                                                                                                                                                                                                                                                                                                                                                    | DB2 through DBCD, definitions pinned, fallback download into the cache.                                                                                                                        |
| Tests under [`importer/tests/Altrobe.Core.Tests`](https://github.com/Cloudmancermedia/altrobe/tree/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7/importer/tests/Altrobe.Core.Tests)                                                                                                                                                                                                                                                                                                             | `Fake.cs` and the converter tests. They run without a CDN. Bring the ones that cover code we copy.                                                                                             |

`tools/probe/Convert/` is an older copy of the same converter. Do not bring it. The source of truth is `Altrobe.Core`.

### 3.2 Resolving a look (do not rewrite)

[`Resolve/LookResolver.cs`](https://github.com/Cloudmancermedia/altrobe/blob/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7/importer/src/Altrobe.Core/Resolve/LookResolver.cs) turns a race, sex, and customization choices into geosets and texture layers. The header lists the Forever-specific fixes over wow.export. Keep them. They are why a face has a jaw and an orc has ears:

- Options with flag `0x20` still get a default choice (otherwise the undead jaw geoset 202 is missing).
- Choices are filtered by `ChrCustomizationReq` for a fresh, non-death-knight character.
- Every element of a choice counts, not only the last one read.
- Ears default to 702, not 701.
- An SD option takes the HD model's default when the names match.

[`Resolve/ItemResolver.cs`](https://github.com/Cloudmancermedia/altrobe/blob/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7/importer/src/Altrobe.Core/Resolve/ItemResolver.cs) turns an item ID plus race, sex, and body kind into models, geosets, texture sections, and attachment points. One item resolves differently per race. Cache the resolved JSON per `(build, itemId)`, which is what their bundle layout `items/{itemId}.json` already is.

### 3.3 The viewer (copy, then fit our app)

These files have no dressing-room UI in them. They are the renderer. They live in our `widgets/character-model` slice, loaded only by the character route.

| File                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Keep because                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`web/src/viewer/dress.ts`](https://github.com/Cloudmancermedia/altrobe/blob/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7/web/src/viewer/dress.ts)                                                                                                                                                                                                                                                                                                       | Pure. Slot names, inventory type to slot, geoset priority, helmets hiding hair, cloak painted on the body when the item has no model, weapon attachment and sheath points. No Three.js.      |
| [`web/src/viewer/compositor.ts`](https://github.com/Cloudmancermedia/altrobe/blob/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7/web/src/viewer/compositor.ts)                                                                                                                                                                                                                                                                                             | The body-texture bake, in the browser, on a small WebGL context. Multiply, overlay, and screen match wow.export's shader. Output is raw RGBA, top-down, `texture.flipY = false`.             |
| [`web/src/viewer/character.ts`](https://github.com/Cloudmancermedia/altrobe/blob/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7/web/src/viewer/character.ts)                                                                                                                                                                                                                                                                                               | Loads the glTF, applies the composited skin, attaches item models at the bones, plays animations.                                                                                            |
| [`web/src/viewer/prepare.ts`](https://github.com/Cloudmancermedia/altrobe/blob/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7/web/src/viewer/prepare.ts)                                                                                                                                                                                                                                                                                                   | Fetches the base look and the resolved items, then calls `dress`. No Three.js. Our version reads our API instead of their bundle.                                                            |
| [`web/src/viewer/m2-material.ts`](https://github.com/Cloudmancermedia/altrobe/blob/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7/web/src/viewer/m2-material.ts), [`particles.ts`](https://github.com/Cloudmancermedia/altrobe/blob/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7/web/src/viewer/particles.ts), [`particle-mesh.ts`](https://github.com/Cloudmancermedia/altrobe/blob/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7/web/src/viewer/particle-mesh.ts) | Glows on shoulders and weapons. `OutputVersion` 2 exists because of this. Dropping it makes enchanted weapons flat.                                                                          |
| [`web/src/viewer/stage.ts`](https://github.com/Cloudmancermedia/altrobe/blob/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7/web/src/viewer/stage.ts)                                                                                                                                                                                                                                                                                                       | One renderer, one canvas. Take the single-view path. Do not take the six-up compare layout.                                                                                                  |
| [`web/src/look/look.ts`](https://github.com/Cloudmancermedia/altrobe/blob/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7/web/src/look/look.ts) and [`docs/look-format.md`](https://github.com/Cloudmancermedia/altrobe/blob/b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7/docs/look-format.md)                                                                                                                                                                  | The look JSON: `race`, `sex`, `models`, `custom` (option ID to choice ID), `items` (slot name to item ID). Use it as the description our API produces. Do not use their share-link encoding. |

Bring the unit tests next to those files. They are how we know a port did not drop a geoset.

`Viewer.tsx` is their app shell (panels, compare, prompt). Do not copy it. Write our own thin route: official render underneath, viewer on top when the assets are ready, our name from the character snapshot instead of their nameplate editor.

## 4. Leave

Do not port these. They are the dressing room, the assistant, or the hosting we are not using.

| Leave                                                                                                                   | Why                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Altrobe.Server` except the idea of `BakeCommand`                                                                       | Assistant, MCP, Claude, local-install session.                                                                                                                                                                                                                                |
| `desktop-extension/`, `infra/`, `packaging/`                                                                            | Their desktop and AWS setup.                                                                                                                                                                                                                                                  |
| `Catalog/ItemCatalog`, `SetCatalog`, `NotableSets`, `PopularWeapons`, `IdentityCatalog`, `FormCatalog`, `OutfitBuilder` | Search, tier sets, name generator, druid forms. A guild page does not browse the item database.                                                                                                                                                                               |
| `web/src/assistant/`, `web/src/components/`, `web/src/identity/`                                                        | The dresser UI.                                                                                                                                                                                                                                                               |
| Side-by-side compare, sheathe toggle, camera presets, druid forms                                                       | Not the guild page. Sheathe can come later. The attachment points are already in `dress.ts`, so leaving the toggle does not lose the data.                                                                                                                                    |
| HD/SD switch as a user control                                                                                          | Forever's client has no classic Blood Elf model (wowmodelviewer's own notes). Use the body kind the bake says exists. Do not offer a switch that renders a hole.                                                                                                              |
| Their full-catalog bake                                                                                                 | They convert every item for every race and sex, because any visitor might pick any item. We convert the race bodies once per build, then the item displays the roster actually wears. A character in a new item enqueues that item. Sixteen members do not justify a catalog. |

## 5. Do differently

### 5.1 The Armory join, which they do not have

Our API already aims to cache the character snapshot. The baker consumes it. The mapping:

| Battle.net                                   | Look field                                                                                                                                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `character-appearance` customization choices | `custom`: option ID to choice ID. Confirm the Forever payload actually carries those IDs before writing the mapper. The client package has the resource. The live response is still unchecked. |
| `character-equipment` item IDs and slots     | `items`: their slot names (`head`, `shoulder`, `chest`, `mainhand`, …). `dress.ts` `SLOT_NAMES` is the table.                                                                                  |
| Race and gender from the profile             | `race`, `sex` (0 male, 1 female).                                                                                                                                                              |
| Missing or unmapped choice                   | The bake's default for that option, and a notice. Never a failed page.                                                                                                                         |
| No profile (under level 10)                  | No model. The page says so.                                                                                                                                                                    |

When the snapshot's look hash is unchanged, enqueue nothing. When an item file ID is not in the store, enqueue that conversion and return `pending` with the official render. The character page polls. The roster does not. That behaviour is already in [character rendering §7](character-rendering.md).

### 5.2 A smaller bake

Their `BundleBaker` writes the whole catalog and refuses to publish if counts drop more than 5 percent. We keep the safety idea and change the scope.

Per Forever build, ahead of time:

- Every playable race body the client has, both sexes, with Stand and the one emote the page offers.
- The texture layers those bodies need for the default look.

Per roster refresh, only what is missing:

- Resolved JSON for each equipped item ID.
- The item's models, textures, and attachments.

`current.json` still moves only when the new build's body set converted cleanly. A failed bake keeps the previous build, and the page keeps showing it or the official render.

### 5.3 Where it sits in our repo

```text
apps/model-baker/     .NET 10 console. Altrobe.Core convert + resolve + a thin bake command. Own Dockerfile.
apps/api/             Enqueues file IDs. Never references the baker assembly.
apps/web/             widgets/character-model, lazy on the character route.
```

The baker image is the only one with .NET and the only one that may write the asset volume. The API image stays read-only. From milestone B they share Postgres through pg-boss: the API inserts a job keyed by `(build, fileId)`, the baker runs it once. Milestone A does not have that queue. The baker is a command, and the page reads one fixed look.

Do not add a second Node reimplementation of M2 "so the stack stays one language". The converter is about 30 k lines of tested C#. Rewriting it is how this slips.

### 5.4 Attribution

Every copied file keeps, at the top:

- Altrobe's copyright and MIT notice.
- The wow.export copyright and MIT notice where Altrobe already has it (`LookResolver.cs`, `dress.ts`, `compositor.ts`, `character.ts`).
- For vendored `.dbd` files, the WoWDBDefs CC BY-SA 4.0 notice and the commit they were taken from.

`THIRD-PARTY-NOTICES` in the baker image lists TACTSharp, DBCD, and those three sources. Do not copy Altrobe's `forever-sets.json` or `popular-weapons.json`. Those are curated game-ID lists, not code.

## 6. Build order

Two milestones. The first one does not know who a guild member is and does not call Battle.net. Gear is a fixed look we choose. The second milestone swaps that fixed look for the real equipment.

Each phase ends with `pnpm verify` for the TypeScript, and `dotnet test` for the baker. Do not start a phase by copying the whole Altrobe repo.

### Milestone A. One character on screen, locally and on the server

The baker is a command, not a job queue. The page reads a fixed look JSON from the asset store. No `apps/api` character module, no pg-boss, no Armory.

1. **Baker skeleton.** New `apps/model-baker`. Copy `Convert/`, `Storage/CdnSource.cs`, `Tables/`, and the `.dbd` files at the pinned WoWDBDefs commit. Add the game-content check. `dotnet test` passes without a network. No API, no web.
2. **Bake one fixed look.** Run the baker once against the CDN for one race and sex, the default customization, and a small fixed outfit (one chest, one weapon is enough). Write the glTF, the PNG layers, and a `look.json` into the asset store, gitignored. Record the timings into [character rendering §8](character-rendering.md), replacing the estimates. Which items are in the outfit does not matter.
3. **Viewer.** Copy `dress.ts`, `compositor.ts`, `character.ts`, `prepare.ts`, the material and particle files, and their tests. A minimal page, not the guild site, loads that `look.json` and the baked files from our own origin. CI uses a stand-in glTF we author ourselves, a few kilobytes, so the test never needs Blizzard bytes. The real bake stays out of git.
4. **Same thing on the server.** The baker image and a static server (Caddy, or the page's own host) run on the Linux host with the asset volume. Opening the page there shows the same character as locally. This is the gate for milestone A. Serving those bytes is the owner's call in [character rendering §12](character-rendering.md), made before this step, not after.

### Milestone B. The real items

Only after milestone A is boring: the same character, same animation, locally and on the server.

5. **The join.** The character module maps a Battle.net snapshot to a look, lists the file IDs, and enqueues the missing ones on pg-boss. The baker becomes the worker for those jobs. HTTP tests cover `ready`, `pending`, and `unavailable` with fake ports. Confirm `character-appearance` on the live Forever API here, not earlier. If it does not return choice IDs, write down what it does return before mapping. Missing choices fall back to the bake's defaults.
6. **The page.** The character route shows the official render first and swaps in the model when `ready`. Polling stays on that route. The roster stays images. Playwright against the stub and the stand-in glTF.

## 7. Checks for the agent doing the work

- Diff against Altrobe at `b864982`, not against whatever `main` is that week. If we need a newer converter fix, bump the pin in this file in the same change.
- Do not commit `.glb`, `.png` from the game, BLP, DB2, or CASC indexes. The content check must fail when one appears.
- Do not import `apps/model-baker` from `apps/api` or `apps/web`.
- Do not load Three.js on the roster or the hero.
- A copied function keeps its tests. A geoset change without a failing test first is not done.
- Leave their assistant, catalog, and AWS code where it is.
