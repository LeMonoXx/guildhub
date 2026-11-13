# 0006. Frontend framework: React

- Status: Accepted
- Date: 2026-11-13

## Context

`apps/web` is a static SPA for a guild site: a public guild page, character pages with item tooltips, and a small logged-in area. The team knows Angular. The rest of the repo is TypeScript with zod contracts shared with the API.

Options considered:

- **React 19 + Vite + TanStack Router + TanStack Query.** Uses the zod contracts directly, with type-safe routes and loaders. Native fit with Aspire's `addViteApp`. The largest ecosystem for component libraries, testing, tooltips, and 3D (for a later animated character view). Router, forms, and UI kit are separate libraries, so the choices must be fixed in writing.
- **Angular with signals and standalone components.** Router, forms, HTTP client, and DI included. Known to the team. Heavier for a mostly read-only site, and the zod contracts would be used through an adapter.

## Decision

React 19 with the React Compiler, built by Vite, with TanStack Router, TanStack Query, and TanStack Form. The stack and React rules are in [frontend architecture](../architecture/frontend.md) §8.

## Consequences

- Shared contracts flow from the API to the UI without code generation.
- The team learns React and the TanStack libraries instead of reusing Angular knowledge.
- Styling and headless UI primitives are still to be chosen; they get their own records when `apps/web` is scaffolded.
