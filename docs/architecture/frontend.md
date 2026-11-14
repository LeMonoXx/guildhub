# Frontend architecture (`apps/web`)

`apps/web` is a React app ([decision 0006](../decisions/0006-frontend-framework.md)); section 8
lists the stack and React-specific rules. Its first portal slice is the bilingual guild home,
member directory, and character detail, with retained cinematic/viewer lab routes. The reusable
animation and intro boundaries are defined in [character cinematics](character-cinematics.md).
The guild home may mount one lazy shared multi-actor WebGL stage on capable devices
([decision 0010](../decisions/0010-adaptive-shared-character-stage.md)).

The web app is a static single-page app built by Vite. It is served by Caddy on the same origin as the API.

## 1. Layers

The structure follows Feature-Sliced Design. Layers are ordered; a layer may import only from layers **below** it.

```mermaid
flowchart TD
  app[app\nbootstrap, providers, router, global styles, error boundary] --> pages
  pages[pages\none folder per route: composes widgets and features] --> widgets
  widgets[widgets\nlarge self-contained blocks: roster table, character header] --> features
  features[features\nuser actions: login button, roster filter, edit guild note] --> entities
  entities[entities\nbusiness objects: guild, character, item, user — model, queries, small UI] --> shared
  shared[shared\nui kit, api client, i18n, config, lib — no business knowledge]
```

| Layer      | Contains                                                                                 | May import                                        |
| ---------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `app`      | Entry point, providers (query client, i18n, theme), router setup, root error boundary    | All layers                                        |
| `pages`    | One slice per route. Reads route params, composes widgets, sets the document title       | `widgets`, `features`, `entities`, `shared`       |
| `widgets`  | Composite blocks used by pages (`roster-table`, `character-equipment`)                   | `features`, `entities`, `shared`                  |
| `features` | One user interaction each, with its UI, state, and the mutation it triggers              | `entities`, `shared`                              |
| `entities` | Domain types (from contracts), query definitions, formatting, small presentational parts | `shared`                                          |
| `shared`   | UI kit (buttons, dialogs, tooltips), API client, i18n setup, design tokens, utilities    | Nothing from the layers above; external libraries |

Rules:

- **Slices on the same layer do not import each other.** `features/login` never imports `features/roster-filter`. Shared needs move one layer down.
- **Each slice exposes one public `index.ts`.** Imports from outside the slice go through it (`@/entities/character`, never `@/entities/character/model/map.ts`).
- **Segments inside a slice:** `ui/` (components), `model/` (state, hooks or services, types), `api/` (query and mutation definitions), `lib/` (pure helpers). A slice has only the segments it needs.
- `shared` knows nothing about guilds or characters. If a component mentions a character, it belongs in `entities` or above.
- `dependency-cruiser` enforces these rules in `pnpm verify` once `apps/web` exists.

## 2. Folder structure

```text
apps/web/
  src/
    app/
    pages/
      guild/             /            hero + guild copy
      members/           /members     searchable roster
      character/         /characters/:slug
      lab/               /lab/*       cinematic and viewer proofs
      me/                /me          own characters (needs login)
      not-found/
    widgets/
    features/
    entities/
      guild/
      character/
      item/
      user/
    shared/
      api/               generated or typed client, ApiError, problem parsing
      ui/                design-system components
      i18n/              locales/de.json, locales/en.json
      config/            instance config loading (from GET /api/instance)
      lib/
  e2e/                   Playwright tests
  public/
```

## 3. Data and state

- **Server state** (anything from the API) lives only in the TanStack Query cache. Components never copy server data into their own state.
- **URL state** (filters, sort, selected tab) lives in the URL. A reloaded or shared link shows the same view.
- **Local UI state** (open dialog, hover) lives in the component.
- **Global client state** is the exception. It needs a reason (for example the theme); then one small store per concern.
- Query keys are defined once per entity in `entities/<x>/api/keys.ts`. Mutations invalidate the keys they affect.

## 4. API access

- The only way to call the API is the client in `shared/api` (`getJson`). Components and hooks never call `fetch` directly. Entity query functions call `/api/guild`, `/api/guild/roster`, `/api/guild/featured`, and `/api/characters/:slug`.
- Request and response types come from `packages/contracts` (the same zod schemas the API validates with). Responses are parsed in development and test builds to catch contract drift; production trusts the types to save work.
- The client sends cookies (`credentials: "same-origin"`), sets `Accept: application/json`, and attaches no tokens. The browser never sees an OAuth token.
- Errors follow the [error model](errors.md): every failure becomes an `ApiError` with a `code`.
- Login is a full-page navigation to `/auth/login?returnTo=<path>`. Logout is a `POST /auth/logout` followed by clearing the query cache.

## 5. Instance configuration and theming

- At startup the app loads `GET /api/instance` (name, region, guild slug, logo URL, copy, theme tokens) and renders nothing guild-specific before that.
- Theme values are CSS custom properties (design tokens: `--color-brand`, `--font-display`, ...), set on `:root` from the instance theme. Components use only tokens, never literal brand colours.
- World of Warcraft class colours are a shared visual standard: `--class-<id>` on `:root` uses Blizzard’s published class palette (Warrior `1` through Evoker `13`). Character names, class labels, and class marks always take their colour from `wowClassColorVar` in `entities/character` (`var(--class-<id>)`). Do not hard-code class hex values in components. Class and race marks are original geometric glyphs in that entity, not Blizzard art.
- Copy (hero text) comes from the instance in each supported locale.

## 6. UI rules

- **Accessibility:** WCAG 2.2 level AA. Semantic HTML first; ARIA only where HTML has no element. Every interactive element works with the keyboard and has a visible focus. Item tooltips open on hover **and** on focus, and close with `Escape`.
- **Internationalisation:** locales `de` and `en` (BCP 47 tags). Dates, numbers, and relative times are formatted with `Intl`, in the user's locale and time zone. No user-visible string is hard-coded in a component.
- **Loading:** skeletons for content areas, never full-page spinners after the first paint. Show cached data while refetching.
- **Images:** character renders and item icons come from Battle.net media URLs via the API, with fixed width and height to avoid layout shift, and lazy loading below the fold. Character detail loads one live character stage lazily. The guild home may replace its static hero composition with one shared multi-actor stage on capable devices; mobile and reduced-motion keep the static composition. See [character rendering](character-rendering.md) and [decision 0010](../decisions/0010-adaptive-shared-character-stage.md).
- **Performance budgets:** LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 on a mid-range phone. Route-level code splitting. Initial JavaScript ≤ 200 kB compressed, excluding the lazy Three.js stage chunk.
- **Security:** no `dangerouslySetInnerHTML` / `[innerHTML]` with API data. External scripts (for example Wowhead tooltips) only from hosts allowed by the CSP.

## 7. Testing

| Level         | What                                                          | How                                                          |
| ------------- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| Unit          | `lib/` helpers, formatting, model logic                       | Vitest                                                       |
| Component     | Slices in isolation, all states (loading, empty, error, data) | Vitest + Testing Library, API mocked with MSW                |
| End to end    | Journeys: open guild page, open character, log in, see "Me"   | Playwright against the Aspire stack with the Battle.net stub |
| Accessibility | Each page in E2E                                              | `@axe-core/playwright`, zero violations at level AA          |

Every component test covers the error state for at least one `ApiError` code.

## 8. React stack

| Concept         | Choice                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| UI library      | React 19 with the React Compiler                                                                        |
| Build and dev   | Vite, started by Aspire (`addViteApp`)                                                                  |
| Routing         | TanStack Router, file-based routes in `src/app/routes/` that render `pages/*`                           |
| Server state    | TanStack Query; route loaders call `queryClient.ensureQueryData` so data starts loading with navigation |
| Local state     | `useState` / `useReducer`                                                                               |
| API client      | `shared/api` functions over `fetch`, typed by `packages/contracts`                                      |
| Error boundary  | Route `errorComponent` and `notFoundComponent`, plus a root error boundary in `app`                     |
| Forms           | TanStack Form with the zod schemas from `packages/contracts`                                            |
| Component tests | Vitest, Testing Library React, MSW                                                                      |
| Lint            | Repo ESLint config plus `eslint-plugin-react-hooks` and `eslint-plugin-jsx-a11y`                        |

React rules:

- Function components and hooks only. One component per file, file name in `kebab-case`, component name in `PascalCase`.
- No manual `useMemo`, `useCallback`, or `React.memo` for performance; the React Compiler handles memoisation. Use them only when a library needs a stable identity, with a comment.
- No `useEffect` for data fetching or for deriving state. Data comes from queries and loaders; derived values are computed during render.
- Route files in `app/routes/` stay thin: params validation, loader, and rendering the page from `pages/`. Business UI lives in the layers.
- Context is for app-wide concerns provided in `app` (query client, i18n, theme). Not for passing data between features.

Styling for this slice is semantic CSS custom properties and vanilla CSS. There is no utility
framework in the bundle. Headless UI primitives for dialogs, menus, and tooltips remain open until
a component needs them; native HTML covers the portal navigation, locale switcher, and roster
filters.
