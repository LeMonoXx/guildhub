import { problemSchema } from "@guildhub/contracts";
import { parseContract, type Parseable } from "./parse";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

/** Game texts come in the page's language, which `<html lang>` carries. */
const withContentLocale = (path: string): string => {
  if (typeof document === "undefined") return path;
  const lang = document.documentElement.lang;
  if (!lang) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}locale=${encodeURIComponent(lang)}`;
};

export const getJson = async <T>(
  path: string,
  schema: Parseable<T>,
): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(withContentLocale(path), {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new ApiError("network.unavailable", 0, "The network is unavailable.");
  }
  if (!response.ok) throw await toApiError(response);
  return parseContract(schema, await response.json());
};

const toApiError = async (response: Response): Promise<ApiError> => {
  const fallback = new ApiError("internal", response.status, "Request failed.");
  try {
    const parsed = problemSchema.safeParse(await response.json());
    if (!parsed.success) return fallback;
    return new ApiError(
      parsed.data.code,
      parsed.data.status,
      parsed.data.title,
    );
  } catch {
    return fallback;
  }
};
