import { expect, it } from "vitest";
import { readEnv } from "./env.js";

const valid = {
  BATTLENET_CLIENT_ID: "id",
  BATTLENET_CLIENT_SECRET: "secret",
  BATTLENET_REDIRECT_URI: "http://localhost:3000/auth/callback",
  INSTANCE_DIR: "/tmp/instance",
  SESSION_SECRET: "x".repeat(32),
};

it("defaults the port when it is unset", () => {
  expect(readEnv(valid).PORT).toBe(3000);
});

it("names the missing fields and does not echo their values", () => {
  expect(() => readEnv({ ...valid, BATTLENET_CLIENT_SECRET: "" })).toThrow(
    "Invalid environment: BATTLENET_CLIENT_SECRET",
  );
});

it("rejects a session secret shorter than 32 characters", () => {
  expect(() => readEnv({ ...valid, SESSION_SECRET: "short" })).toThrow(
    "Invalid environment: SESSION_SECRET",
  );
});

it("requires an instance directory", () => {
  expect(() => readEnv({ ...valid, INSTANCE_DIR: "" })).toThrow(
    "Invalid environment: INSTANCE_DIR",
  );
});
