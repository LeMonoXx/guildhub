# 0010. Adaptive shared character stage on the guild home

- Status: Accepted
- Date: 2026-11-13

## Context

[Decision 0008](0008-character-models-gltf.md) put live Three.js on the character page and kept
the roster and hero on official stills so the landing JavaScript budget stayed intact. The first
portal slice still needs a guild home that can show several members in one authored lineup, using
the current fixed rogue look six times, without six renderers or six copies of the same glTF.

Mobile viewports, missing WebGL, and `prefers-reduced-motion: reduce` cannot take that cost. Those
visitors still need the same editorial composition: names, rank, and links, with no layout shift
when a capable session mounts the live stage.

## Decision

The guild home may mount **one** lazy, shared multi-actor WebGL stage on capable devices.

- One `WebGLRenderer`, one scene, one cinematic timeline, and one `AssetStore`.
- Actor handles clone from that store. They do not fetch the same look again.
- Capability is the conjunction of WebGL, a desktop-width viewport, an intersecting stage, and no
  reduced-motion preference. Failure of any gate keeps the static composition.
- The static composition is the source of layout. The canvas occupies a reserved slot that stays optically empty (transparent, no stage chrome) so characters read as walking on the page.
- Character detail keeps the existing single-character cinematic renderer.
- Roster and member-index routes do not import Three.js.
- Blizzard game bytes stay untracked. Design-reference JPEGs are not copied into the repo.

This amends the “character page only” clause of decision 0008 for the guild home. Cached glTF,
the official render as fallback on character pages, and the baker/API split are unchanged.

## Consequences

- Home can show a six-actor lineup of the current look without a second rendering stack.
- Initial JavaScript on `/` and `/members` must still meet the 200 kB compressed budget; the stage
  is a separate async chunk.
- Frame-time budgets apply to the shared stage: one clock, no extra renderers, dispose on leave.
- Reduced-motion and mobile QA are mandatory; they are not optional polish.
- Later Battle.net looks swap behind the same actor registry and asset store. Pages never learn
  class-specific branches.
