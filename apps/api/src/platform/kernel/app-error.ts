import type { ProblemCode, ProblemFieldError } from "@guildhub/contracts";

export interface AppError<C extends ProblemCode = ProblemCode> {
  readonly code: C;
  readonly detail?: string;
  readonly meta?: Readonly<Record<string, string | number>>;
  readonly errors?: readonly ProblemFieldError[];
  readonly retryAfterSeconds?: number;
}

export function appError<C extends ProblemCode>(
  code: C,
  extras: Omit<AppError<C>, "code"> = {},
): AppError<C> {
  return { code, ...extras };
}
