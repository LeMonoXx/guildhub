# Error model (backend and frontend)

There is no ISO standard for API error formats. The applicable standard is **RFC 9457, "Problem Details for HTTP APIs"** (IETF, 2023, replaces RFC 7807). GuildHub uses it for every error response, and both apps share one error catalog.

## 1. Error categories

| Category       | Meaning                                                    | Handled as                              | Example code                  |
| -------------- | ---------------------------------------------------------- | --------------------------------------- | ----------------------------- |
| Validation     | The request is malformed or violates a schema              | Value, `400`                            | `request.invalid`             |
| Authentication | No valid session                                           | Value, `401`                            | `auth.required`               |
| Authorization  | Valid session, but not allowed                             | Value, `403`                            | `access.forbidden`            |
| Not found      | The resource does not exist (or is hidden from the caller) | Value, `404`                            | `character.not_found`         |
| Conflict       | The request conflicts with current state                   | Value, `409`                            | `guild_note.version_conflict` |
| Rule violation | Well-formed, but a business rule rejects it                | Value, `422`                            | `event.starts_in_past`        |
| Rate limited   | The caller sends too much                                  | Value, `429` with `Retry-After`         | `request.rate_limited`        |
| Upstream       | Battle.net is down, slow, or rate-limits us                | Value, `503` (or stale data, see below) | `upstream.unavailable`        |
| Defect         | A bug or an unexpected failure                             | Exception, `500`                        | `internal`                    |

Expected outcomes (all rows except "Defect") are **values**: functions return `Result<T, E>` with `E` a union of error objects. Only defects are thrown.

## 2. Error codes

- Format: `<area>.<reason>` in `snake_case`, for example `character.not_found`, `auth.session_expired`.
- Codes are part of the API contract. Once released, a code never changes meaning. New codes may be added. Removing a code needs a decision record.
- The catalog lives in `packages/contracts/src/problems.ts`. Each entry has the code, the HTTP status, an English title, and whether the client may retry.

```ts
export const PROBLEMS = {
  "request.invalid": {
    status: 400,
    title: "The request is invalid.",
    retryable: false,
  },
  "auth.required": {
    status: 401,
    title: "Sign in to continue.",
    retryable: false,
  },
  "character.not_found": {
    status: 404,
    title: "This character was not found.",
    retryable: false,
  },
  "upstream.unavailable": {
    status: 503,
    title: "Battle.net is not reachable right now.",
    retryable: true,
  },
  internal: {
    status: 500,
    title: "Something went wrong on our side.",
    retryable: true,
  },
} as const satisfies Record<string, ProblemDefinition>;

export type ProblemCode = keyof typeof PROBLEMS;
```

## 3. Backend

### 3.1 Inside the core

```ts
export interface AppError<C extends ProblemCode = ProblemCode> {
  readonly code: C;
  readonly detail?: string; // safe for users, never contains secrets or internals
  readonly meta?: Readonly<Record<string, string | number>>; // e.g. { characterSlug }
}

export type Result<T, E extends AppError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
```

- Domain and application functions declare their error union in the return type. TypeScript then forces callers to handle each case.
- Infrastructure catches library exceptions at the adapter edge and converts them: a Battle.net `404` becomes `character.not_found`, a timeout or `5xx` becomes `upstream.unavailable`, a unique-constraint violation becomes the matching `*.conflict`. Everything it cannot classify is rethrown as a defect.
- When upstream fails and the cache has data, the use case returns the cached data with `stale: true` instead of an error. The error is returned only when there is nothing to show.

### 3.2 At the HTTP edge

One function turns an `AppError` into a response; one `onError` handler turns any thrown value into a `500`. Route handlers never build error bodies by hand.

Response (`Content-Type: application/problem+json`):

```json
{
  "type": "/problems/character.not_found",
  "title": "This character was not found.",
  "status": 404,
  "detail": "No character 'monox-belvar' in this guild.",
  "instance": "/api/characters/monox-belvar",
  "code": "character.not_found",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736"
}
```

- `type` is a relative URI derived from the code, resolved against the deployment's own origin (RFC 9457 allows relative references). It does not need to resolve yet; when it does, it documents the error.
- `title` comes from the catalog and does not vary between occurrences.
- `detail` is optional and safe to show. It never includes stack traces, SQL, upstream bodies, tokens, or internal IDs.
- `code` and `traceId` are extension members. `traceId` is the W3C Trace Context trace ID of the request, so a user report can be found in the logs.
- Validation problems add `errors`: a list of `{ "pointer": "/body/name", "code": "too_short", "detail": "At least 2 characters." }`, with `pointer` as a JSON Pointer (RFC 6901) into the request.
- `401` responses do not reveal whether a user exists. `404` is used instead of `403` when the existence of the resource is itself private.
- `429` and `503` send `Retry-After`.

### 3.3 Logging errors

| Kind                   | Log level | Stack trace | On the span                     |
| ---------------------- | --------- | ----------- | ------------------------------- |
| 4xx `AppError`         | `info`    | no          | attribute `error.code`          |
| `upstream.unavailable` | `warn`    | no          | status error, `error.code`      |
| Stale data served      | `warn`    | no          | event `cache.stale_served`      |
| Defect (500)           | `error`   | yes         | `recordException`, status error |

## 4. Frontend

- The API client is the only code that reads HTTP responses. For every non-2xx response it parses the body with the `Problem` schema from `packages/contracts` and throws (or returns) an `ApiError { status, code, title, detail, errors, traceId }`. A body that is not a valid problem becomes `ApiError` with code `internal`.
- Network failures (offline, DNS, CORS, abort) become `ApiError` with code `network.unavailable` and `status: 0`. Timeouts become `network.timeout`.
- **Messages shown to users come from the frontend's translations, keyed by `code`**, not from `title` or `detail`. `detail` may be shown as secondary text. Unknown codes fall back to the message for their status class.
- Display rules:

| Situation                                          | UI                                                                               |
| -------------------------------------------------- | -------------------------------------------------------------------------------- |
| Field validation (`request.invalid` with `errors`) | Inline message at each field matched by `pointer`; focus the first invalid field |
| `auth.required` / `auth.session_expired`           | Redirect to login, then back to the original route                               |
| `access.forbidden`                                 | Inline "not allowed" state in the affected area; no redirect                     |
| `*.not_found` on a page's main resource            | The route's not-found page                                                       |
| `upstream.unavailable` with data present           | Show data plus a "last updated <time>" notice                                    |
| `upstream.unavailable` without data                | Route error state with a retry button                                            |
| Failed mutation (button, form)                     | Toast or inline message next to the control; the form keeps its input            |
| `internal` or unknown                              | Route error state with a retry button and the `traceId` in a copyable "error ID" |

- Every route has an error boundary. A failure in one widget does not blank the page.
- Retries: queries retry automatically only for `retryable` codes and network errors, at most twice, with backoff. Mutations never retry automatically.
- Frontend defects (render errors, unhandled rejections) are reported through OpenTelemetry for the web (or a no-op locally) with the route and release version, never with personal data.

## 5. Checklist for a new error

1. Add the code to `PROBLEMS` in `packages/contracts`.
2. Add it to the error union of the use case that returns it, and test that path.
3. If an adapter produces it, map it there and test the mapping with a fixture.
4. Add the user-facing message in every frontend locale.
5. If the UI needs special handling, add it to the display rules above.
