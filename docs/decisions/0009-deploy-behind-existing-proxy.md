# 0009. Deploy behind the host's existing proxy

- Status: Accepted
- Date: 2026-11-13

## Context

The production machine is a Linux server that already runs Docker and two or three other websites. Something on that host already accepts public HTTP and HTTPS. GuildHub must be added beside those sites, not in front of them.

[0007](0007-deployment-compose-linux.md) put a Caddy container inside GuildHub's Compose and gave it ports 80 and 443 with its own Let's Encrypt certificate. On this server that takes the ports the existing sites use.

The wish is continuous deployment later: a green `main` updates the server without a manual upload. Nothing is wired up now. This record fixes the shape so the application does not grow a second TLS stack or a public Docker port.

## Decision

GuildHub serves plain HTTP on the Docker network only. The host's existing reverse proxy terminates TLS and routes one hostname to it. A deploy pulls images already built by CI and restarts the containers. It does not bake models, issue certificates, or open a new public port.

The steps, the hostname rule, and the SSH setup are in [deployment](../deployment.md). They are written now so the first version fits them. They are not built now.

## Consequences

- The application never sees a certificate. It trusts `X-Forwarded-Proto` from the proxy and builds its public URL from `PUBLIC_ORIGIN`. The session cookie stays `Secure` because the browser still uses HTTPS.
- Web, API, auth, and assets stay on one hostname. The proxy routes by path. A second hostname for the API would break the cookie and force CORS.
- If the host later has no proxy, a Caddy container can be added in front of the same HTTP services. The application does not change.
- GitHub reaches the server over SSH as a deploy user whose only command is the deploy script. The Docker socket is not exposed.
