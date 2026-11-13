import pino, { type Logger, type LoggerOptions } from "pino";

const redactPaths = [
  "authorization",
  "cookie",
  "set-cookie",
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers.set-cookie",
  "*.accessToken",
  "*.refreshToken",
  "*.clientSecret",
  "*.sessionToken",
];

export interface LoggerConfig {
  readonly level: string;
  readonly serviceName: string;
}

export function createLogger(
  config: LoggerConfig,
  destination?: pino.DestinationStream,
): Logger {
  const options: LoggerOptions = {
    level: config.level,
    base: { service: config.serviceName },
    redact: { paths: redactPaths, censor: "[Redacted]" },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  return destination === undefined ? pino(options) : pino(options, destination);
}
