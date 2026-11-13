# 0005. Battle.net OAuth with server-side sessions

- Status: Accepted
- Date: 2026-11-13

## Context

Users log in with their Battle.net account. We do not want our own passwords, and we must not expose OAuth tokens to the browser.

## Decision

- The API runs the OAuth authorization code flow with Battle.net through `arctic` (a maintained OAuth client with a Battle.net provider). We do not implement the protocol ourselves.
- After the callback, the API creates a server-side session in Postgres and sets an opaque `__Host-gh_session` cookie (`HttpOnly`, `Secure`, `SameSite=Lax`). The database stores only the SHA-256 hash of the session token.
- Session handling (creation, rotation, idle and absolute expiry, logout) follows the OWASP Session Management Cheat Sheet. It is small and lives in the identity module.
- User access tokens are not stored. If a feature needs them, it gets a new record that defines encryption at rest and lifetime.

## Consequences

- No token in the browser. XSS cannot steal a bearer token, and the frontend has no token logic.
- Sessions can be revoked at once (delete the row).
- Every API request does one indexed session lookup. That is cheap at guild scale.
