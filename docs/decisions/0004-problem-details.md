# 0004. RFC 9457 problems with stable error codes

- Status: Accepted
- Date: 2026-11-13

## Context

Backend and frontend need one way to describe failures, which the UI can translate and which can be traced to logs.

## Decision

Every error response is `application/problem+json` per RFC 9457, extended with `code` (stable, from a shared catalog in `packages/contracts`), `traceId`, and for validation `errors[]` with JSON Pointers. Expected failures are values (`Result`) inside the backend; only defects are thrown. The frontend shows messages translated by `code`.

Details: [error model](../architecture/errors.md).

## Consequences

- A standard format that tools and libraries understand.
- Error codes become part of the contract and need the same care as response fields.
- `Result` return types make use-case signatures longer, in exchange for exhaustive handling checked by the compiler.
