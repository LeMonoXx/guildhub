# GuildHub

GuildHub is a platform for a World of Warcraft: Forever guild site. One install serves one guild through configuration: slug, region, logo, copy, and theme.

Traceless is the first instance (`eu` / `traceless`). The guild is not hard-wired into the platform.

## What runs today

`apps/api` is the server process. It checks its environment and answers `GET /health`. Battle.net login, the guild roster, and the site UI are not built yet.

The API is Node because `@blizzard-api/wow-forever` is a TypeScript package. The web UI is not in this repo until the React or Angular choice is made. The verification commands stay the same when that package is added.

## Verify

Requires Node 22 or newer and pnpm 10.

```sh
pnpm install
pnpm verify
```

`pnpm verify` checks formatting, lint, types, tests, and the API build.

## Run the API

Copy `.env.example` to `.env` and fill in the Battle.net client values. `SESSION_SECRET` is at least 32 characters. Those values stay in the environment. They are not baked into the image.

```sh
docker compose up --build
```

The image listens on port 3000. Docker uses the `HEALTHCHECK` against `/health`.
