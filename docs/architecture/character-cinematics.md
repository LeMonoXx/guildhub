# Character cinematics

How character models, game animation tracks, authored effects, camera moves, lighting, and page
transitions form reusable character-detail intros.

The first proof is a looping human-male rogue intro on the cinematic lab. It is an instance of this
architecture, not a special component. The guild home and character page build their scenes in
widgets (`buildLineupScene`, `buildCharacterIdleScene`) from each member's look manifest. The API
returns looks and model status; it does not pick a cinematic JSON. A new class intro must be data
plus assets; it must not add another timeline implementation.

## 1. Boundaries

The system has four boundaries:

1. **Model baker:** reads M2 data and writes versioned, renderer-neutral animation metadata and glTF.
2. **Character runtime:** owns one dressed model, its clips, item/effect models, materials, particles,
   and GPU resources.
3. **Cinematic runtime:** evaluates a validated scene against one master clock. It has no React or
   Three.js dependency.
4. **Bindings:** apply sampled cinematic values to a character runtime, stage, and DOM overlay.

React owns mounting and status UI. It does not own mixers, render loops, clocks, or Three.js objects.
Three.js does not know about routes, guilds, or React.

## 2. Extension model

Animation and cinematic behavior is open for extension through registries:

- The baker registers one animation-channel exporter per M2 track kind.
- The browser registers one compiled track binding per cinematic track kind.
- Particle generator shapes and authored effects use registered strategies.
- Asset selection uses an animation bake policy rather than a command-specific ID branch.

Dispatch occurs once at a composition boundary. Runtime loops call polymorphic objects with
`update`, `setTime`, `reset`, and `dispose`; they do not branch on every supported kind.

Closed binary enums such as an M2 blend mode may use a table or an exhaustive switch inside their
own adapter. They must not leak branching into the character or cinematic runtimes.

## 3. Ownership

Every resource has exactly one owner:

- An asset store owns fetched source bytes and in-flight request deduplication.
- A model instance owns the GPU resources created for that instance.
- An animation controller owns mixers, clips, actions, crossfades, and animation time.
- An effect system owns particle/effect instances.
- A character handle composes model instances, animation controllers, and effects.
- A stage owns the renderer, scene, camera, lights, and the actor handles currently on it. A home
  lineup uses one stage and one shared asset store for every cloned look.
- A cinematic engine owns only its clock and compiled bindings, never GPU resources.

`dispose` is idempotent. Shared geometry, material, and texture objects are disposed once, by the
owner that created them. A loop reset seeks existing resources back to time zero; it does not reload
or recreate them.

## 4. Time

The cinematic engine is the only scene clock. Character clips, global sequences, material tracks,
particles, camera, lights, authored smoke, and DOM tracks derive their state from the same absolute
time.

`update(delta)` advances normal playback. `setTime(time)` must reproduce a deterministic frame.
`reset()` is equivalent to `setTime(0)` plus restoration of initial visibility and active clips.
Crossing the loop duration performs one hard reset and retains only the remainder, preventing drift.

The stage may provide real frame deltas, but it never advances subsystems independently.

## 5. Layered character animation

A character has one base animation and zero or more independently addressed overlays. An overlay
never replaces or pauses the base clip. Scene clip values may declare an overlay with a stable
layer ID, animation group, semantic mask, weight, and fade duration.

The animation controller implements overlays as follows:

- the base clip continues on its original clock and mixer action;
- the overlay clip is filtered to the bones selected by its semantic mask;
- the filtered clip is converted to an additive clip relative to its authored first frame;
- filtered clips and mixer actions are cached and owned by the animation controller;
- `update`, deterministic `setTime`, `reset`, fades, and disposal include every active layer.

Masks are skeleton semantics, not scene-specific bone lists. `upper-body` resolves from the
exported spine key-bone metadata and includes its descendants. New masks extend the mask registry
and its contract tests; they do not add class, character, or scene conditionals to the cinematic
engine. This allows running attacks, casts, emotes, item use, and future facial layers to share the
same mechanism.

## 6. Scene data

A versioned contract describes:

- asset/look reference;
- duration and loop policy;
- named markers;
- character clip and visibility tracks;
- transform, camera, light, stage, and UI tracks;
- authored and baked effects;
- future audio cues;
- a reduced-motion poster frame.

The contract is validated before assets are built. Each track definition is compiled once into a
binding. Adding another intro normally adds a scene document and a bake configuration, not code.

Audio cues are part of the schema from version 1 but the first rogue proof does not play sound.

## 7. Rogue proof

The first scene uses a human male rogue, class ID 4, HD models, Bloodfang Armor, and two daggers:

1. Black initial frame while all assets are prewarmed.
2. The rogue starts invisible far behind the stage and runs continuously toward the camera.
3. Perspective and authored scale make him grow without a pose or animation pause.
4. A masked additive `UseStandingStart` layer drives the spine, arms, and head while the base
   `Run` clip keeps the lower body running; the throw starts the authored smoke.
5. Character visibility reaches zero inside the smoke.
6. Smoke, lights, and page treatment fade to the exact initial frame.
7. The engine resets without reallocating assets and loops immediately.

WoW item particles and material tracks continue throughout. Authored smoke is renderer-owned,
seeded, and seekable so CI and loop reset do not depend on a spell visual kit.

The bake preset provides Stand, Walk, Run, Ready1H, SpellCastOmni, KneelStart, KneelLoop,
KneelEnd, StealthWalk, StealthStand, UseStandingLoop, UseStandingStart, and UseStandingEnd. The scene keeps `Run` as its base clip and
uses `UseStandingStart` as an additive `upper-body` overlay. Masks resolve from exported key-bone
metadata instead of character-specific bone numbers, so layered actions remain reusable across
supported skeletons. SpellCast and Emerge are requested by the preset but diagnosed and skipped
because this skeleton does not expose them.

## 8. Authoring and visual proof

`apps/web/test-fixtures/cinematics/rogue-proof.scene.json` is authored lab data and may be committed.
Portal scenes are not static JSON: the home troop and character page build them from look manifests.
The generated character assets under `apps/model-baker/assets/` are ignored and must never be
committed.

Bake and run the proof from the repository root:

```powershell
dotnet run --project apps/model-baker/src/GuildHub.ModelBaker.Cli/GuildHub.ModelBaker.Cli.csproj -- bake-proof-scene rogue-t2 --output apps/model-baker/assets/proof/rogue-t2 --cache apps/model-baker/cache --region eu
$env:GUILDHUB_ASSET_ROOT="$PWD\apps\model-baker\assets\proof\rogue-t2"
pnpm --filter @guildhub/web dev
```

The guild portal defaults to the shared `assets/fixed` store so hashed looks are visible. The cinematic
lab still uses this Bloodfang proof; set `GUILDHUB_ASSET_ROOT` as above when you want that scene.

The default route plays the loop; `?viewer=1` retains the free viewer. `?frame=<milliseconds>`
renders a deterministic, non-playing frame for authoring and visual regression evidence. The
defined proof checkpoints are 0 (dark start), 250 (far reveal), 2000 (approach), 4000
(running throw), 5300 (full smoke coverage), 5699 (covered pre-vanish), 5700 (vanish), and 8000
(exact reset).
The actor remains visible until the opaque cloud is established. The 0 and 8000 screenshots must
be byte-identical when captured at the same viewport.

The web image builds the contracts package before the app. Mount the ignored proof output at
`/srv/assets` to repeat the same checkpoints in the Linux container.

## 9. Architecture fitness gates

Before a new track or intro is accepted:

- a new kind is registered without editing the cinematic evaluation loop;
- baker track exporters have synthetic binary fixtures and GLB assertions;
- `setTime` and `reset` reproduce the same sampled state across repeated loops;
- layered actions preserve the base clip outside their semantic mask;
- asset requests deduplicate while in flight;
- disposal is idempotent and touches each owned GPU resource once;
- React imports no Three.js outside the character widget boundary;
- pure cinematic modules import neither React nor Three.js;
- dependency-cruiser enforces the boundaries;
- authored CI assets contain no Blizzard bytes;
- the real scene passes local and Linux-container visual checkpoints.

F5 performance is measured on a real deployment. Immutable HTTP caching removes repeated transfers,
but parsing, compositing, scene construction, and GPU upload remain after a hard reload; development
Vite behavior is not an optimization baseline.
