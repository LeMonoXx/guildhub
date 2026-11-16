using System.Diagnostics;
using Microsoft.Extensions.Logging;
using OpenTelemetry;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace GuildHub.ModelBaker.Cli;

public sealed class Observability : IDisposable
{
    public const string ServiceName = "guildhub-model-baker";
    public static readonly ActivitySource Activities = new(ServiceName);

    readonly TracerProvider _traces;
    readonly MeterProvider? _metrics;

    Observability(ILoggerFactory loggerFactory, TracerProvider traces, MeterProvider? metrics)
    {
        LoggerFactory = loggerFactory;
        _traces = traces;
        _metrics = metrics;
    }

    public ILoggerFactory LoggerFactory { get; }

    public static Observability Create()
    {
        var resource = ResourceBuilder.CreateDefault().AddService(ServiceName);
        var traces = Sdk.CreateTracerProviderBuilder()
            .SetResourceBuilder(resource)
            .AddSource(ServiceName)
            .AddHttpClientInstrumentation();
        MeterProvider? metrics = null;

        if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("OTEL_EXPORTER_OTLP_ENDPOINT")))
        {
            traces.AddOtlpExporter();
            metrics = Sdk.CreateMeterProviderBuilder()
                .SetResourceBuilder(resource)
                .AddRuntimeInstrumentation()
                .AddOtlpExporter()
                .Build();
        }

        var loggerFactory = Microsoft.Extensions.Logging.LoggerFactory.Create(builder =>
        {
            builder.SetMinimumLevel(LogLevel.Information);
            builder.Configure(options =>
            {
                options.ActivityTrackingOptions =
                    ActivityTrackingOptions.TraceId |
                    ActivityTrackingOptions.SpanId |
                    ActivityTrackingOptions.ParentId |
                    ActivityTrackingOptions.Tags |
                    ActivityTrackingOptions.Baggage;
            });
            // stdout carries the serve protocol.
            builder.AddConsole(options => options.LogToStandardErrorThreshold = LogLevel.Trace);
            builder.AddJsonConsole(options =>
            {
                options.IncludeScopes = true;
                options.TimestampFormat = "O";
                options.UseUtcTimestamp = true;
            });
        });

        return new Observability(loggerFactory, traces.Build(), metrics);
    }

    public void Dispose()
    {
        _metrics?.Dispose();
        _traces.Dispose();
        LoggerFactory.Dispose();
    }
}
