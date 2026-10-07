import { describe, expect, it } from "vitest";
import { parseEnv, proGatesEnforced } from "./env";

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
  it("defaults the model and scan-cap vars, leaving the Gemini key optional", () => {
    const parsed = parseEnv({ ...base, GOOGLE_GENERATIVE_AI_API_KEY: "", MODEL_FAST: "", MODEL_STRONG: "", DAILY_AI_SCAN_CAP: "" });
    expect(parsed.GOOGLE_GENERATIVE_AI_API_KEY).toBeUndefined();
    expect(parsed.MODEL_FAST).toBe("gemini-3.5-flash-lite");
    expect(parsed.MODEL_STRONG).toBe("gemini-3.5-flash");
    expect(parsed.DAILY_AI_SCAN_CAP).toBe(300);
  });
  it("coerces a numeric DAILY_AI_SCAN_CAP", () => {
    expect(parseEnv({ ...base, DAILY_AI_SCAN_CAP: "50" }).DAILY_AI_SCAN_CAP).toBe(50);
  });
});

describe("PRO_GATES_ENFORCED", () => {
  it("defaults to off and accepts true/false/1/0", () => {
    expect(parseEnv(base).PRO_GATES_ENFORCED).toBe(false);
    expect(parseEnv({ ...base, PRO_GATES_ENFORCED: "true" }).PRO_GATES_ENFORCED).toBe(true);
    expect(parseEnv({ ...base, PRO_GATES_ENFORCED: "1" }).PRO_GATES_ENFORCED).toBe(true);
    expect(parseEnv({ ...base, PRO_GATES_ENFORCED: "false" }).PRO_GATES_ENFORCED).toBe(false);
    expect(() => parseEnv({ ...base, PRO_GATES_ENFORCED: "on" })).toThrow(/PRO_GATES_ENFORCED/);
  });
  it("proGatesEnforced reads it fresh", () => {
    expect(proGatesEnforced({})).toBe(false);
    expect(proGatesEnforced({ PRO_GATES_ENFORCED: "true" })).toBe(true);
  });
});
