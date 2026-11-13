# Observability

GuildHub is observable at the process boundary from the first executable onward. A telemetry
backend is optional infrastructure: applications always produce structured logs, and they export
OpenTelemetry traces and metrics when an OTLP endpoint is configured. No business or HTTP code
depends on a particular vendor, dashboard, or collector.

## 1. Signal contract

| Signal  | Produced by                                                               | Transport                                                                                        |
| ------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Logs    | Every process, as one JSON object per line                                | stdout/stderr. Aspire and container tooling collect it; no in-process log store                  |
| Traces  | HTTP server/client, database, jobs, and explicit use-case or bake spans   | OTLP when `OTEL_EXPORTER_OTLP_ENDPOINT` is set; otherwise spans stay local and no export retries |
| Metrics | Runtime/process plus bounded application counters, histograms, and gauges | OTLP when `OTEL_EXPORTER_OTLP_ENDPOINT` is set                                                   |

The production Compose stack does **not** require an observability sink. Adding one later means
setting standard `OTEL_*` variables or forwarding stdout; it does not require application changes.
Aspire supplies an OTLP endpoint locally and is the first development sink.

Browser telemetry is deliberately excluded for now. The static SPA must not receive an OTLP
credential or send traces directly to an internal collector. Add browser telemetry only with a
separate decision covering consent, privacy, sampling, and a same-origin ingestion endpoint.

## 2. Resource identity and propagation

Every process sets:

- `service.name`: `guildhub-api`, `guildhub-worker`, `guildhub-model-baker`, and so on.
- `service.version`: the image commit SHA in deployment.
- `deployment.environment.name`: `development`, `test`, or `production`.
- `service.instance.id`: supplied by the runtime when useful; never used as a metric label.

Defaults live in code. Deployment overrides use the OpenTelemetry environment conventions:
`OTEL_SERVICE_NAME`, `OTEL_RESOURCE_ATTRIBUTES`, `OTEL_EXPORTER_OTLP_ENDPOINT`, and the
signal-specific exporter variables.

HTTP uses W3C Trace Context (`traceparent` and `tracestate`). Outbound Battle.net and database
spans remain children of the request or job span. Async jobs persist trace context only where it is
useful for causality; a scheduled refresh also starts a new root trace with a link to its enqueue
trace.

## 3. Logging contract

Operational logs are structured events, not prose dumps. Common fields are:

- `timestamp`, `level`, `message`;
- `service`, `module`, and a stable event name where the event is queried;
- `trace_id`, `span_id`, and `trace_flags` when a span is active, as specified by OpenTelemetry for
  non-OTLP JSON logs;
- `requestId` for support and HTTP response correlation;
- route **pattern**, method, status, and duration for requests;
- exception type, message, and stack for unexpected failures.

Never log authorization headers, cookies, OAuth codes or tokens, session tokens, client secrets,
database URLs, raw upstream bodies, or complete character/account payloads. Logger-level redaction
is mandatory even when the call site already avoids those fields. User-facing CLI output is not an
operational log and may remain plain text.

Levels:

- `error`: unexpected failures, 5xx requests, failed jobs, failed bakes;
- `warn`: degraded operation, retries, stale-cache fallback, rejected commands;
- `info`: lifecycle and meaningful state transitions;
- `debug`: health probes and development diagnostics;
- `trace`: disabled by default and never used for payload dumps.

## 4. Traces

The Node API uses `@hono/otel`, Hono's built-in request-ID middleware,
`@hono/structured-logger`, OpenTelemetry's pino instrumentation, and pino itself. Add another
official instrumentation only when its technology lands; do not install
the all-framework metapackage. Node starts with OpenTelemetry's ESM loader hook so those official
instrumentations can patch native ESM imports; do not replace the hook with hand-written
correlation. The baker uses
`Microsoft.Extensions.Logging` and the OpenTelemetry .NET SDK. These packages own propagation,
request lifecycle timing, trace/log correlation, and OTLP encoding; GuildHub supplies only policy
and configuration.

Instrumentation covers Hono HTTP requests and .NET HTTP clients today. Add Node HTTP-client
instrumentation with the first outbound adapter, and PostgreSQL instrumentation with persistence.
Explicit spans use low-cardinality names:

- `guild.get-roster`, `character.refresh`, `identity.callback`;
- `job.<job-name>`;
- `baker.resolve-look`, `baker.convert-model`, `baker.convert-texture`.

IDs, character names, item IDs, URLs, and build hashes are attributes only when needed; they never
appear in span names. Expected domain outcomes set status and stable error code attributes without
recording an exception. Unexpected exceptions are recorded and rethrown or mapped at the boundary.

Sampling is parent-based. Development records all traces. Production sampling is configured at
deployment through `OTEL_TRACES_SAMPLER` and `OTEL_TRACES_SAMPLER_ARG`; errors must still have a
correlated structured log because head sampling cannot know the final status.

## 5. Metrics

Runtime/process metrics are enabled with OTLP. Application metrics use bounded labels only:

- HTTP duration and status class by route pattern;
- Battle.net request duration, status class, and operation;
- cache hit/miss and stale fallback by cache kind;
- job duration and result by job name;
- bake duration and result by asset kind.

Never label a metric with user, guild, character, item, file, trace, request, build, or session ID.
Those dimensions are unbounded and belong in traces or logs.

## 6. Lifecycle, failure, and tests

- Telemetry starts before instrumented libraries are imported or resources are created.
- Shutdown stops accepting work, flushes telemetry with a deadline, then exits.
- A missing or unavailable collector never makes the API or baker unhealthy.
- Export failures are diagnostics, not recursive application logs.
- Unit tests use no exporter and make no network request.
- Tests cover log JSON shape, redaction, trace correlation, and disabled-exporter behaviour.
- Integration tests may use an in-memory exporter. CI never requires Aspire or a remote sink.
