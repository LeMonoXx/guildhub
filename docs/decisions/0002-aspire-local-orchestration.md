# 0002. Aspire for local orchestration and telemetry

- Status: Accepted
- Date: 2026-11-13

## Context

Local development needs Postgres, the API, a migrator, the Battle.net stub, and the web app, started in the right order, with logs and traces in one place. Coding agents need the same runtime evidence as humans. The team knows Aspire from .NET.

Since Aspire 13.2 the AppHost can be written in TypeScript and run on Node. The .NET SDK is only needed for C# AppHosts or .NET projects. Aspire has hosting integrations for Node apps, Vite apps, and PostgreSQL. It exposes resources, logs, and traces to agents through the Aspire CLI (`--format Json`) and an optional MCP server (`aspire agent mcp`). It can publish the model as Docker Compose.

Alternatives: Docker Compose alone (no dashboard, no agent interface, no ordered startup of local dev processes), Tilt, devcontainers.

## Decision

Use Aspire with a TypeScript AppHost in `apphost/` as the single way to run the system locally. Instrument every process with OpenTelemetry so the Aspire Dashboard shows logs, traces, and metrics. Use Aspire's Docker Compose publisher to produce the production Compose file ([0007](0007-deployment-compose-linux.md)).

## Consequences

- One command (`aspire run`) for the full stack. No hand-maintained local `.env` with ports and connection strings.
- Developers and agents need the Aspire CLI and Docker in addition to Node and pnpm. The AppHost stays TypeScript. The model baker is a .NET project, so the .NET 10 SDK is needed to test and build it. Aspire does not need that SDK to orchestrate.
- CI does not depend on Aspire for unit and integration tests (Testcontainers covers the database), so an Aspire problem cannot block merges.
- Application processes own instrumentation, correlated JSON logs, and OTLP exporters. Aspire is
  a local sink, not a runtime dependency. Production may leave the OTLP endpoint unset until an
  operator chooses a backend; application health and logging do not depend on one.
- Aspire moves fast. Pin the CLI and integration versions, and update them deliberately.
