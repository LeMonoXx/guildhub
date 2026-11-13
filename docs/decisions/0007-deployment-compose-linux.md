# 0007. Docker Compose on a Linux server

- Status: Accepted. The edge and the deploy path are refined by [0009](0009-deploy-behind-existing-proxy.md): this host already serves other sites, so GuildHub does not bind ports 80 or 443 and does not run its own Caddy.
- Date: 2026-11-13

## Context

GuildHub serves one guild. Traffic is small. It should run on one Linux server at low cost, be easy to restore, and use the same images CI tested.

## Decision

- Production runs on one Linux host with Docker Engine and Docker Compose.
- The Compose file is generated from the Aspire AppHost with `aspire publish` (Docker Compose environment) and committed under `deploy/`, so a change to the system shape is reviewed like code. Until the AppHost exists, `compose.yaml` in the repo root is the hand-written stand-in.
- Services: `caddy` (TLS via Let's Encrypt, routes `/api` and `/auth` to the API, everything else to the web assets), `api`, `worker`, `migrate` (one-shot, must finish before `api` and `worker` start), `postgres` (named volume), and a backup job (nightly `pg_dump` to storage outside the host).
- CI builds images once, tags them with the commit SHA, and pushes them to GitHub Container Registry. Deployment pulls a tag and runs `docker compose up -d`.
- Secrets live in an `.env` file on the server (owner-only permissions), never in the repo or the images.

## Consequences

- No Kubernetes and no cloud lock-in. One host is a single point of failure, which is acceptable for a guild site; backups and a documented restore cover it.
- Telemetry in production: the API exports OTLP. A standalone Aspire Dashboard container (with authentication) or a hosted OpenTelemetry backend receives it. That choice is made when the server is set up.
