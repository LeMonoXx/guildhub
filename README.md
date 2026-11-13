# GuildHub

GuildHub is a platform for a World of Warcraft: Forever guild site. One install serves one guild through configuration: slug, region, logo, copy, and theme.

Traceless is the first instance (`eu` / `traceless`). The guild is not hard-wired into the platform.

## Architecture and rules

- [North star](docs/north-star.md): the target system, principles, data, security, roadmap
- [Backend](docs/architecture/backend.md), [frontend](docs/architecture/frontend.md), [observability](docs/architecture/observability.md), [error model](docs/architecture/errors.md), [character rendering](docs/architecture/character-rendering.md), and its [implementation plan](docs/architecture/character-rendering-plan.md)
- [Development, local stack, and agents](docs/development.md)
- [Deployment](docs/deployment.md): later, onto the existing Linux host behind its proxy
- [Standards register](docs/standards.md) and [decision records](docs/decisions/)
- [`AGENTS.md`](AGENTS.md): working rules for coding agents and humans

## What runs today

`apps/api` is the server process. It checks its environment, loads the instance config, answers
`/health/live` and `/health/ready`, uses PostgreSQL, and serves a cached guild profile and roster.
`packages/contracts` is the shared problem, instance, and guild schema. `apps/battlenet-stub` fakes
the Battle.net endpoints the API needs today. `apps/model-baker` converts a manually selected fixed
Forever look, and `apps/web` renders that look with Three.js. Battle.net login and real character
pages are not built yet.

The API is Node because `@blizzard-api/wow-forever` is a TypeScript package. The standalone
Milestone-A viewer is React 19 and Vite; it intentionally has no guild-site routes or Armory
integration yet.

## Verify

Requires Node 24 (LTS). pnpm comes from the `packageManager` field through corepack:

```sh
corepack enable pnpm
pnpm install
pnpm verify
```

If `corepack enable` cannot write next to Node (Windows under `Program Files`), use `corepack enable --install-directory "$env:APPDATA\npm" pnpm`.

`pnpm verify` checks formatting, lint, and import boundaries across the repo, then runs `typecheck`, `test`, and `build` in every workspace package that defines them. A new package under `apps/` or `packages/` joins by adding those scripts.

Shared tool versions (TypeScript, Vitest, `@types/node`) live in the `catalog` in `pnpm-workspace.yaml`. pnpm installs no release younger than one day (`minimumReleaseAge`). Dependabot waits the same day.

## Run the API

Copy `.env.example` to `.env` and fill in the Battle.net client values. `SESSION_SECRET` is at least 32 characters. Those values stay in the environment. They are not baked into the image.

```sh
docker compose up --build
```

The image listens on port 3000. Docker uses the `HEALTHCHECK` against `/health`. The container runs as a non-root user on a read-only filesystem. On `SIGTERM` it closes open connections and exits with code 0.

Logs are JSON on stdout. `OTEL_EXPORTER_OTLP_ENDPOINT` is optional; when set, the API exports traces
and metrics to that OTLP endpoint. No collector is required to run the API.

## Run the fixed character

Bake the gitignored model assets from Blizzard's `wowf` CDN:

```sh
dotnet run --project apps/model-baker/src/GuildHub.ModelBaker.Cli -- bake-fixed
```

Then run the viewer against that output:

```powershell
$env:GUILDHUB_ASSET_ROOT="$PWD\apps\model-baker\assets\fixed"
pnpm --filter @guildhub/web dev
```

For the Linux-container equivalent, the `model-baker` Compose profile writes the named asset volume
and the web container serves it:

```sh
docker compose --profile models run --rm model-baker
docker compose up --build web
```
