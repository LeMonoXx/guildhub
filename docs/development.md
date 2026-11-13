# Development, local stack, and agents

## 1. Today

```sh
corepack enable pnpm
pnpm install
pnpm verify            # format, lint, types, tests, build
pnpm --filter @guildhub/api dev   # API with reload on :3000 (needs .env)
docker compose up --build         # API image
```

Everything below is the target. Sections say when a step depends on a roadmap item.

Today, the API and model baker already emit structured JSON logs. Setting
`OTEL_EXPORTER_OTLP_ENDPOINT` enables their OTLP traces and metrics. Leaving it unset is supported:
no collector is required for `pnpm verify`, `dotnet test`, or normal process health. See
[observability](architecture/observability.md).

## 2. One command for the whole stack: Aspire

GuildHub uses **Aspire** with a **TypeScript AppHost** (`apphost/apphost.ts`) for local orchestration. Aspire 13.2+ supports a TypeScript AppHost with no .NET SDK in our toolchain; the Aspire CLI manages its orchestration engine. It needs Node 24 and Docker (or Podman).

```sh
aspire run            # start everything, open the dashboard
aspire start          # start in the background (agents use this)
aspire wait           # block until resources are healthy
aspire describe       # resource states and endpoints
aspire stop
```

The AppHost declares the local system. This is a sketch of the target; check method names against the Aspire TypeScript API reference when it is built:

```ts
const builder = await createBuilder();

const postgres = await builder.addPostgres("postgres");
await postgres.withDataVolume();
await postgres.withPgWeb();
const db = await postgres.addDatabase("guildhub");

const battlenet = await builder
  .addNodeApp("battlenet-stub", "../apps/battlenet-stub", "src/main.ts")
  .withHttpEndpoint({ env: "PORT" });

const migrate = await builder
  .addNodeApp("migrate", "../apps/api", "src/migrate.ts")
  .withReference(db)
  .waitFor(db);

const api = await builder
  .addNodeApp("api", "../apps/api", "src/main.ts")
  .withHttpEndpoint({ env: "PORT" })
  .withHttpHealthCheck("/health/ready")
  .withReference(db)
  .withReference(battlenet)
  .waitForCompletion(migrate);

await builder.addViteApp("web", "../apps/web").withReference(api).waitFor(api);

await builder.build().run();
```

What this gives us:

- PostgreSQL 18 in a container with a persistent volume, plus a database browser.
- Migrations run before the API, every time.
- Connection strings and URLs are injected as environment variables. Nobody edits ports or `.env` files for local runs.
- The **Aspire Dashboard**: resource states, console logs, structured logs, traces, and metrics over OpenTelemetry for every process.
- The **Battle.net stub** by default. Switching to the real Battle.net is one AppHost parameter, with the client ID and secret stored as Aspire user secrets (never in the repo).

Why not only Docker Compose: Compose has no telemetry dashboard, no health-ordered startup of local
processes with reload, and no agent interface. Aspire publishes Compose for production anyway (see
[decision 0007](decisions/0007-deployment-compose-linux.md)).

Aspire injects its OTLP endpoint into each resource. Application images contain only SDKs and
exporters; they do not contain the dashboard or a telemetry database.

## 3. Battle.net stub (`apps/battlenet-stub`)

- A small Hono server that implements the parts of Battle.net we use: `/authorize`, `/token`, `/userinfo`, the OAuth redirect flow, and the Profile and Game Data endpoints for one guild.
- Responses come from recorded, anonymised fixtures in `apps/battlenet-stub/fixtures/`, captured once from the real API for Traceless and checked in.
- Fake users for login: for example `guildmaster`, `member`, `outsider`, chosen on a stub login page. E2E tests and agents log in without real accounts.
- Error switches (`?fail=503`, `?fail=429`) let tests and agents exercise degraded paths.

## 4. Database workflow

| Task                           | Command                                                        |
| ------------------------------ | -------------------------------------------------------------- |
| Change the schema              | Edit `src/modules/<m>/infrastructure/schema.ts`                |
| Create a migration             | `pnpm --filter @guildhub/api db:generate --name <what>`        |
| Check migrations for conflicts | `pnpm --filter @guildhub/api db:check` (part of `pnpm verify`) |
| Apply migrations locally       | Happens on `aspire run`; or restart the `migrate` resource     |
| Reset local data               | Delete the Postgres volume from the dashboard, then restart    |
| Seed demo data                 | `seed` resource in the AppHost (target)                        |

Production uses the same migrations, run by a one-shot `migrate` container before the API starts.

## 5. Tests locally

```sh
pnpm test              # unit and HTTP tests, no Docker needed
pnpm test:int          # integration tests, starts Postgres via Testcontainers (needs Docker)
pnpm test:e2e          # Playwright against a running `aspire start` stack
pnpm verify            # the CI gate: format, lint, boundaries, types, tests, build
```

CI does not use Aspire. It runs `pnpm verify`, integration tests with Testcontainers, and the image boot check. E2E in CI starts the stack with `aspire start` once the web app exists.

## 6. Working with agents

Agents (Cursor, Claude Code, Codex, Copilot) follow [`AGENTS.md`](../AGENTS.md). The stack is built so an agent can do what a developer does, without secrets.

| Need                       | How the agent gets it                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Rules and architecture     | `AGENTS.md` (root and per app) and the documents in `docs/`                                                        |
| Start and stop the stack   | `aspire start`, `aspire wait`, `aspire stop`                                                                       |
| Resource states, endpoints | `aspire describe --format Json`                                                                                    |
| Logs and traces            | `aspire logs <resource>`, `aspire otel logs`, `aspire otel traces` (all `--format Json`), or the Aspire MCP server |
| Database                   | Postgres MCP server (`withPostgresMcp()` in the AppHost) or pgweb, local data only                                 |
| The UI                     | Playwright or the editor's built-in browser against the `web` endpoint                                             |
| Login                      | Battle.net stub users, no real credentials                                                                         |
| "Is it done?"              | `pnpm verify` passes, and the affected journey works in the running stack                                          |

Setup once per machine: `aspire agent init` installs the Aspire skills and, if selected, the MCP server configuration for the agent environments in use. Generated agent configuration that contains machine paths stays out of the repo.
