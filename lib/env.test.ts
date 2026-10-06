import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const base = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "id",
  GOOGLE_CLIENT_SECRET: "secret",
};

describe("parseEnv", () => {
  it("accepts a complete env", () => {
    expect(parseEnv(base).DATABASE_URL).toBe(base.DATABASE_URL);
  });
  it("treats empty strings as missing", () => {
    expect(() => parseEnv({ ...base, GOOGLE_CLIENT_ID: "" })).toThrow(/GOOGLE_CLIENT_ID/);
  });
  it("leaves DATABASE_URL to the db client (optional here)", () => {
    expect(parseEnv({ ...base, DATABASE_URL: "" }).DATABASE_URL).toBeUndefined();
  });
  it("rejects a short auth secret", () => {
    expect(() => parseEnv({ ...base, BETTER_AUTH_SECRET: "short" })).toThrow(/BETTER_AUTH_SECRET/);
  });
});
