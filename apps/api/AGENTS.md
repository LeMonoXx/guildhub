# apps/api

Rules for the API. The root [`AGENTS.md`](../../AGENTS.md) applies too. The full design is in [`docs/architecture/backend.md`](../../docs/architecture/backend.md).

## Current state

`src/index.ts` is the composition root. Shared HTTP, env, instance loading, kernel, and observability live under `src/platform/`. Feature modules land under `src/modules/` when they exist.

## Import rules (summary)

```text
main.ts / worker.ts   -> anything (composition root)
modules/<m>/http      -> own application, `import type` from own domain, packages/contracts, platform/http, platform/kernel
modules/<m>/infrastructure -> own application ports, own domain, platform/db, platform/observability, platform/kernel, libraries
modules/<m>/application    -> own domain, platform/kernel, other modules' index.ts only
modules/<m>/domain         -> own domain, platform/kernel — nothing else
platform/*            -> platform/*, libraries — never modules/*
```

- No `process.env` outside `platform/config` or the composition root. No `console.*`; use the
  structured logger. Follow `docs/architecture/observability.md`.
- No `Date.now()` / `new Date()` in domain or application; use the `Clock` port.
- Route handlers call one use case and map the result. No queries, no Battle.net calls, no business rules in handlers.
- Drizzle row types and Battle.net response types never leave `infrastructure`.

## Tests

- `*.test.ts` next to the code, run by `pnpm --filter @guildhub/api test`.
- `*.int.test.ts` for database tests (Testcontainers, needs Docker).
- Every use case: one test per outcome in its error union plus the success path.
