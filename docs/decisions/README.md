# Decision records

One file per architecture decision, numbered, never renumbered. A record is **Proposed**, **Accepted**, **Superseded by NNNN**, or **Rejected**. To change an accepted decision, write a new record that supersedes it.

Template:

```markdown
# NNNN. Title

Status: Proposed | Accepted | Superseded by NNNN
Date: YYYY-MM-DD

## Context

What forces the decision.

## Decision

What we do.

## Consequences

What gets easier, what gets harder, what we must watch.
```

| No.                                          | Title                                        | Status   |
| -------------------------------------------- | -------------------------------------------- | -------- |
| [0001](0001-hono-bff.md)                     | Hono backend-for-frontend                    | Accepted |
| [0002](0002-aspire-local-orchestration.md)   | Aspire for local orchestration and telemetry | Accepted |
| [0003](0003-postgres-drizzle.md)             | PostgreSQL 18, Drizzle, pg-boss              | Accepted |
| [0004](0004-problem-details.md)              | RFC 9457 problems with stable error codes    | Accepted |
| [0005](0005-battlenet-oauth-bff-sessions.md) | Battle.net OAuth with server-side sessions   | Accepted |
| [0006](0006-frontend-framework.md)           | Frontend framework                           | Proposed |
| [0007](0007-deployment-compose-linux.md)     | Docker Compose on a Linux server             | Accepted |
