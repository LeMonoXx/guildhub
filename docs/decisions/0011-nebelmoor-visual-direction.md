# 0011. Nebelmoor visual direction, page fog, and self-hosted typefaces

- Status: Accepted
- Date: 2026-11-14

## Context

The first portal looked like a World of Warcraft launcher: gold gradients, gold frames, a red
primary button. The guild is called Traceless, and the site should feel like it: dark, cold,
foggy, with the game present only where it belongs (class colours, item quality colours, item and
talent tooltips, the character stage).

The redesign must not change content or behaviour. Every existing animation (the stage and its
choreography, count-ups, reveals, embers, meters) stays as it is; only its colours change.

## Decision

- **Tokens, not one-off colours.** The gold accent becomes pale fog light. `--color-gold` keeps its
  name so existing rules follow automatically; new tokens `--color-light`, `--color-deep`,
  `--color-wisp`, `--color-blood` and the channel triplets `--accent-rgb`, `--accent-deep-rgb`,
  `--light-rgb`, `--fog-rgb` replace literal gold values. Game colours (class, item quality,
  talents, achievements, the unit frame) are unchanged.
- **One bright path per view.** The primary button is bone white instead of red and gold.
- **Page fog.** `shared/ui/nebula-fog` draws the fog behind all content, lit by a cold light above
  the stage and a lantern that follows the pointer, densest near the bottom of the window and the
  stage floor. Where WebGL 2 can render to half-float textures, the fog is a real fluid: a small GPU
  solver for the incompressible Navier-Stokes equations after Stam's "Stable Fluids"
  (semi-Lagrangian advection, Jacobi pressure projection, vorticity confinement) in
  `shared/lib/nebula-fog-fluid.ts`. The pointer pushes the fog aside and stirs it into eddies,
  scrolling drags it along, a gentle curl-noise breeze keeps it moving, and wiped areas refill
  toward a resting fog field within a few seconds. The fog also follows the guild stage: a
  read-only frame decorator (`FogPresence`) reports each actor's screen position through
  `shared/lib/fog-channel`; walking actors drag and shoulder the fog aside, their feet stir it,
  and the resting fog banks up around them. `shared/ui/fog-veil` runs a second instance of the same fluid
  solver in front of the stage (layer `veil`, coarser grid, asleep while the stage is off screen),
  so both layers look alike. It rests only as a thin, torn haze on the stage floor (present before the characters walk in); the rest is fog the characters stir up: puffs at the feet and trails along the legs that rise and drift away. Standing figures leave it calm, walking drags and parts it, so the troop stands inside the fog. `stage` strengthens it, `veil` sets its opacity. Behind the troop the background fog fades out
  softly (`behind`, default 0.3), so the two layers do not pile up. It deliberately does not copy the background fog frame: a 2D copy
  of a WebGL canvas forces a GPU read-back every frame. `?fog=stage:1,mouse:1,figures:1,veil:1` scales each part for
  comparison during development. Elsewhere a lit noise shader stands in, and under
  `prefers-reduced-motion: reduce` it draws one still frame; without WebGL the plain dark ground
  stays. Both use the WebGL API directly, because Three.js stays confined to the character
  rendering adapters (`web-three-adapter-boundary`) and no maintained package renders a
  translucent fluid fog without it. The fog loads as its own async chunk after first paint, shows
  the lit image at half resolution and pauses with the tab.
- **Typefaces.** The narrative serif is Cormorant Garamond, the text face Inter, both under the
  SIL Open Font License. They are self-hosted: the font files come from
  `@fontsource-variable/cormorant-garamond` and `@fontsource-variable/inter` and are bundled by
  Vite, so no visitor request reaches a third-party font host. `shared/styles/fonts.css` declares
  its own `@font-face` rules instead of importing the packages' stylesheets, so only the Latin and
  Latin Extended subsets ship; Cyrillic, Greek and Vietnamese are left out. The variable files
  are used rather than static weights because the styles use Inter at 400, 500, 600, 650, 700,
  800 and 900 (650 has no static cut, and seven static files outweigh one variable file) and
  Cormorant at 300 to 600. Inter italic ships for the few italic runs; Cormorant italic is not
  used and does not ship. All faces load with `font-display: swap`; the token stacks keep
  Palatino Linotype, Book Antiqua, Georgia and the system sans as fallbacks.

## Consequences

- Restyling stays a token change: themes per instance remain possible through the same custom
  properties.
- The fog adds one small async chunk (about 6 kB compressed) and one extra WebGL context next to
  the character stage. The fluid runs every frame (a 176-cell-wide velocity grid, 18 pressure
  iterations, a 384-cell-wide density grid); watch frame time on mid-range laptops and lower those
  constants first if it costs too much.
- The typefaces add two dependencies and six font files to the build. A page in German or English
  downloads two of them, about 86 kB (Inter Latin 48 kB, Cormorant Garamond Latin 38 kB); the
  Latin Extended files (34 to 85 kB) load only for text that needs them, such as some character
  names, and Inter italic (52 kB) only where italic text is shown. A new subset, an italic serif
  or a further family needs its own `@font-face` rule in `fonts.css`.
