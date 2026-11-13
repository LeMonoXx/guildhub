# Standards register

The external standards GuildHub follows, and where each one applies. Where people often expect an ISO standard but the real standard comes from another body (IETF, W3C, OWASP), the table names the real one.

| Topic                  | Standard                                                          | Applies to                                                                 |
| ---------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Software quality       | ISO/IEC 25010:2023 (product quality model)                        | Naming and ranking quality goals ([north star](north-star.md) §9)          |
| API error responses    | IETF RFC 9457 Problem Details for HTTP APIs                       | Every API error ([errors](architecture/errors.md))                         |
| Pointers into requests | IETF RFC 6901 JSON Pointer                                        | `errors[].pointer` in validation problems                                  |
| HTTP semantics         | IETF RFC 9110 HTTP Semantics, RFC 9111 HTTP Caching               | Methods, status codes, `Cache-Control`, `ETag`, `Retry-After`              |
| Date and time          | ISO 8601, profiled by IETF RFC 3339                               | Every timestamp in the API, always UTC with `Z`                            |
| Language tags          | IETF BCP 47 (built on ISO 639 and ISO 3166)                       | Locales `de`, `en`; `Accept-Language`                                      |
| JSON                   | IETF RFC 8259                                                     | Request and response bodies                                                |
| API description        | OpenAPI 3.1 (uses JSON Schema 2020-12)                            | Generated `openapi.json`                                                   |
| OAuth                  | IETF RFC 6749, RFC 7636 (PKCE), RFC 9700 (OAuth 2.0 Security BCP) | Battle.net login                                                           |
| Identity               | OpenID Connect Core 1.0                                           | `openid` scope with Battle.net                                             |
| Cookies                | IETF RFC 6265 and the `__Host-` prefix rules                      | Session cookie                                                             |
| Application security   | OWASP ASVS 5.0, Level 2                                           | API and web review checklist                                               |
| Accessibility          | W3C WCAG 2.2 Level AA (also published as ISO/IEC 40500:2025)      | Every page                                                                 |
| Tracing                | W3C Trace Context; OpenTelemetry semantic conventions             | `traceparent` propagation, span and attribute names, `traceId` in problems |
| IDs                    | IETF RFC 9562 UUID version 7                                      | Primary keys of our own tables                                             |
| Versioning             | Semantic Versioning 2.0.0                                         | Packages, if we ever publish one; image tags use commit SHAs               |
| Containers             | OCI Image Format                                                  | Built images                                                               |

## Implementation rule

A standard is implemented through the platform or a maintained reference-quality package whenever
one exists. GuildHub does not write its own OAuth protocol, Problem Details format, trace
propagation, OTLP encoding, request-ID middleware, database/file-format parser, retry framework, or
similar generic infrastructure.

Project code may configure those implementations and enforce GuildHub-specific policy. A custom
implementation needs a documented gap analysis: which platform APIs and packages were checked, why
they do not fit, and how compatibility is tested. Current justified exceptions are the specialized
WoW M2/BLP conversion inherited with tests and attribution from Altrobe/wow.export, and the
repository-specific game-content guard. DBCD parses table files and TACTSharp reads CDN storage; we
do not replace either.
