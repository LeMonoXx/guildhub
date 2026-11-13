import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";

export interface TelemetryConfig {
  readonly endpoint?: string;
  readonly serviceName: string;
}

export interface Telemetry {
  readonly enabled: boolean;
  shutdown(): Promise<void>;
}

const disabled: Telemetry = {
  enabled: false,
  shutdown: () => Promise.resolve(),
};

export function startTelemetry(config: TelemetryConfig): Telemetry {
  if (config.endpoint === undefined) return disabled;

  // The exporters read the standard OTEL_EXPORTER_OTLP_* environment variables.
  // OTEL_EXPORTER_OTLP_ENDPOINT is a base URL and gets /v1/traces or /v1/metrics.
  const sdk = new NodeSDK({
    serviceName: config.serviceName,
    traceExporter: new OTLPTraceExporter(),
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter(),
      }),
    ],
    logRecordProcessors: [],
    instrumentations: [
      new PinoInstrumentation({
        disableLogSending: true,
        logKeys: {
          traceId: "trace_id",
          spanId: "span_id",
          traceFlags: "trace_flags",
        },
      }),
    ],
  });

  sdk.start();
  return {
    enabled: true,
    shutdown: () => sdk.shutdown(),
  };
}
