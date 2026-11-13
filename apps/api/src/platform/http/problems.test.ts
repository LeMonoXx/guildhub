import { describe, expect, it } from "vitest";
import { appError } from "../kernel/app-error.js";
import { toProblem } from "./problems.js";

describe("toProblem", () => {
  it("maps an AppError to RFC 9457 JSON", () => {
    expect(
      toProblem(
        appError("guild.not_found", { detail: "No such guild." }),
        "/api/guild",
      ),
    ).toEqual({
      type: "/problems/guild.not_found",
      title: "This guild was not found.",
      status: 404,
      detail: "No such guild.",
      instance: "/api/guild",
      code: "guild.not_found",
      traceId: undefined,
    });
  });
});
