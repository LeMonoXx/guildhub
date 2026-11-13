import { describe, expect, it } from "vitest";
import { PROBLEMS, problemSchema } from "./problems.js";

describe("PROBLEMS", () => {
  it("maps every catalog code to a status and title", () => {
    expect(PROBLEMS.internal).toEqual({
      status: 500,
      title: "Something went wrong on our side.",
      retryable: true,
    });
    expect(PROBLEMS["guild.not_found"].status).toBe(404);
  });
});

describe("problemSchema", () => {
  it("accepts an RFC 9457 problem with GuildHub extensions", () => {
    expect(
      problemSchema.parse({
        type: "/problems/guild.not_found",
        title: "This guild was not found.",
        status: 404,
        detail: "No guild matched this instance.",
        instance: "/api/guild",
        code: "guild.not_found",
        traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      }),
    ).toMatchObject({
      code: "guild.not_found",
      status: 404,
    });
  });
});
