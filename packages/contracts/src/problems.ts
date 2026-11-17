import { z } from "zod";

export interface ProblemDefinition {
  readonly status: number;
  readonly title: string;
  readonly retryable: boolean;
}

export const PROBLEMS = {
  "request.invalid": {
    status: 400,
    title: "The request is invalid.",
    retryable: false,
  },
  "request.not_found": {
    status: 404,
    title: "This resource was not found.",
    retryable: false,
  },
  "request.rate_limited": {
    status: 429,
    title: "Too many requests.",
    retryable: true,
  },
  "auth.required": {
    status: 401,
    title: "Sign in to continue.",
    retryable: false,
  },
  "auth.session_expired": {
    status: 401,
    title: "Your session has expired.",
    retryable: false,
  },
  "access.forbidden": {
    status: 403,
    title: "You cannot do that.",
    retryable: false,
  },
  "guild.not_found": {
    status: 404,
    title: "This guild was not found.",
    retryable: false,
  },
  "media.not_found": {
    status: 404,
    title: "This image was not found.",
    retryable: false,
  },
  "character.not_found": {
    status: 404,
    title: "This character was not found.",
    retryable: false,
  },
  "item.not_found": {
    status: 404,
    title: "This item was not found.",
    retryable: false,
  },
  "upstream.unavailable": {
    status: 503,
    title: "Battle.net is not reachable right now.",
    retryable: true,
  },
  "network.unavailable": {
    status: 0,
    title: "The network is unavailable.",
    retryable: true,
  },
  "network.timeout": {
    status: 0,
    title: "The request timed out.",
    retryable: true,
  },
  internal: {
    status: 500,
    title: "Something went wrong on our side.",
    retryable: true,
  },
} as const satisfies Record<string, ProblemDefinition>;

export type ProblemCode = keyof typeof PROBLEMS;

export const problemFieldErrorSchema = z.object({
  pointer: z.string().min(1),
  code: z.string().min(1),
  detail: z.string().min(1),
});

export const problemSchema = z.object({
  type: z.string().min(1),
  title: z.string().min(1),
  status: z.number().int().nonnegative(),
  detail: z.string().min(1).optional(),
  instance: z.string().min(1).optional(),
  code: z.string().min(1),
  traceId: z.string().min(1).optional(),
  errors: z.array(problemFieldErrorSchema).optional(),
});

export type Problem = z.infer<typeof problemSchema>;
export type ProblemFieldError = z.infer<typeof problemFieldErrorSchema>;
