# 0001. Hono backend-for-frontend

- Status: Accepted
- Date: 2026-11-13

## Context

The Battle.net client secret and user tokens must stay on a server. The best Battle.net client for WoW: Forever, `@blizzard-api/wow-forever`, is TypeScript. Frontend and backend should share request and response types.

## Decision

`apps/api` is a Node 24 backend-for-frontend built with Hono on `@hono/node-server`. It serves only our own web app, on the same origin. Request and response schemas are zod schemas in `packages/contracts`, used by both apps and turned into OpenAPI 3.1.

## Consequences

- One language across the repo, shared contracts, no generated client needed for React.
- Hono is small and standards-based (`Request`/`Response`), so routes are testable in-process with `app.request()`.
- Hono brings no architecture of its own. The layering in [backend architecture](../architecture/backend.md) and its enforcement carry that weight.
