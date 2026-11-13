import { trace } from "@opentelemetry/api";
import { PROBLEMS, type Problem, type ProblemCode } from "@guildhub/contracts";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppError } from "../kernel/app-error.js";

export function currentTraceId(): string | undefined {
  const traceId = trace.getActiveSpan()?.spanContext().traceId;
  return traceId === undefined || /^0+$/.test(traceId) ? undefined : traceId;
}

export function toProblem(error: AppError, instance?: string): Problem {
  const definition = PROBLEMS[error.code];
  const problem: Problem = {
    type: `/problems/${error.code}`,
    title: definition.title,
    status: definition.status,
    instance,
    code: error.code,
    traceId: currentTraceId(),
  };
  if (error.detail !== undefined) problem.detail = error.detail;
  if (error.errors !== undefined) problem.errors = [...error.errors];
  return problem;
}

export function problemResponse(context: Context, error: AppError): Response {
  const problem = toProblem(error, new URL(context.req.url).pathname);
  const status = problem.status as ContentfulStatusCode;
  if (error.retryAfterSeconds !== undefined) {
    context.header("Retry-After", String(error.retryAfterSeconds));
  }
  return context.body(JSON.stringify(problem), status, {
    "Content-Type": "application/problem+json",
  });
}

export function notFoundError(): AppError<"request.not_found"> {
  return { code: "request.not_found" };
}

export function internalError(): AppError<"internal"> {
  return { code: "internal" };
}

export function isProblemCode(value: string): value is ProblemCode {
  return Object.hasOwn(PROBLEMS, value);
}
