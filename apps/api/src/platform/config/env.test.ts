import { expect, it } from "vitest";
import { readEnv } from "./env.js";

const valid = {
  BATTLENET_CLIENT_ID: "id",
  BATTLENET_CLIENT_SECRET: "secret",
  BATTLENET_REDIRECT_URI: "http://localhost:3000/auth/callback",
  DATABASE_URL: "postgres://guildhub:guildhub@127.0.0.1:5432/guildhub",
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

it("defaults the guild cache ttl", () => {
  expect(readEnv(valid).GUILD_CACHE_TTL_SECONDS).toBe(300);
});

it("defaults the character cache ttl and baker region", () => {
  expect(readEnv(valid).CHARACTER_CACHE_TTL_SECONDS).toBe(900);
  expect(readEnv(valid).BAKER_REGION).toBe("eu");
  expect(readEnv(valid).ASSET_ROOT).toBeUndefined();
});

it("treats an empty Battle.net rewrite URL as unset", () => {
  expect(
    readEnv({ ...valid, BATTLENET_API_BASE_URL: "" }).BATTLENET_API_BASE_URL,
  ).toBeUndefined();
});
