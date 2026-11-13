# 0006. Frontend framework

Status: Proposed
Date: 2026-11-13

## Context

`apps/web` is a static SPA for a guild site: a public guild page, character pages with item tooltips, and a small logged-in area. The team knows Angular. The rest of the repo is TypeScript with zod contracts shared with the API.

## Options

**React 19 + Vite + TanStack Router + TanStack Query**

- Uses the zod contracts directly, with type-safe routes and loaders.
- Native fit with Aspire's `addViteApp`.
- Largest ecosystem for component libraries, Testing Library, and tooltip and 3D libraries (for a later animated character view).
- More choices to make: router, forms, and UI kit are separate libraries, fixed by the rules in [frontend architecture](../architecture/frontend.md).

**Angular (current major) with signals and standalone components**

- Batteries included: router, forms, HTTP client, DI. Fewer choices.
- Known to the team.
- Heavier for a mostly read-only site. The zod contracts are used through a thin adapter rather than natively.

## Recommendation

React, for the shared-contract fit and the ecosystem. Either option follows the same layer rules.

## Decision

Open. The repository owner decides before `apps/web` is scaffolded (roadmap step 6).
