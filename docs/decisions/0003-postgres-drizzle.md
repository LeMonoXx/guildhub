# 0003. PostgreSQL 18, Drizzle, pg-boss

Status: Accepted
Date: 2026-11-13

## Context

We store users, sessions, cached Battle.net snapshots, guild extensions, and background jobs. The data is relational (guild has members, members are characters, users own characters). The server is a single Linux host.

## Decision

- **PostgreSQL 18**, the same major version locally (Aspire container) and in production (container with a named volume).
- **Drizzle ORM** for schema and queries, with **drizzle-kit** generating SQL migrations that are reviewed and committed. Drizzle 1.0 is a release candidate today. We start on the newest `1.0.0-rc` with an exact version (no caret), because its migration format (one folder per migration, conflict detection across branches) is what we want long-term, and upgrade to `1.0.0` when it is released.
- **pg-boss** for background jobs (Battle.net refresh), stored in the same database. No Redis.
- `jsonb` for raw Battle.net snapshots that we cache but do not query by field; real columns for what we filter, sort, or join on.

## Consequences

- One stateful service to run, back up, and monitor.
- Drizzle keeps SQL visible and types inferred from the schema. Running a release candidate means reading its release notes on every update; Dependabot must not bump it automatically (exact pin, reviewed manually).
- If Drizzle 1.0 slips or breaks us, Kysely with plain SQL migrations is the fallback. The repository layer hides the choice from use cases.
