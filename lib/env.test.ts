import { afterEach, describe, expect, it, vi } from "vitest";
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

describe("tombstonePepper (review N5)", () => {
  afterEach(() => { vi.restoreAllMocks(); vi.resetModules(); });
  // A fresh module per test, so the warn-once flag starts unset.
  const load = async () => (await import("./env")).tombstonePepper;
  const SECRET = "s".repeat(32);

  it("prefers CREDIT_TOMBSTONE_PEPPER, silently", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const pepper = await load();
    expect(pepper({ CREDIT_TOMBSTONE_PEPPER: "p".repeat(16), BETTER_AUTH_SECRET: SECRET, NODE_ENV: "production" })).toBe("p".repeat(16));
    expect(warn).not.toHaveBeenCalled();
  });
  it("falls back to BETTER_AUTH_SECRET, warning once in production", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const pepper = await load();
    const raw = { CREDIT_TOMBSTONE_PEPPER: "", BETTER_AUTH_SECRET: SECRET, NODE_ENV: "production" };
    expect(pepper(raw)).toBe(SECRET);
    expect(pepper(raw)).toBe(SECRET);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("CREDIT_TOMBSTONE_PEPPER is not set; using BETTER_AUTH_SECRET");
  });
  it("doesn't warn outside production", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await load())({ BETTER_AUTH_SECRET: SECRET, NODE_ENV: "development" })).toBe(SECRET);
    expect(warn).not.toHaveBeenCalled();
  });
  it("a too-short CREDIT_TOMBSTONE_PEPPER fails when the module loads", async () => {
    vi.stubEnv("CREDIT_TOMBSTONE_PEPPER", "short");
    await expect(import("./env")).rejects.toThrow(/CREDIT_TOMBSTONE_PEPPER/);
    vi.unstubAllEnvs();
    vi.resetModules();
    await expect(import("./env")).resolves.toBeDefined();
  });
  it("rejects a short pepper and a missing fallback", async () => {
    const pepper = await load();
    expect(() => pepper({ CREDIT_TOMBSTONE_PEPPER: "short", BETTER_AUTH_SECRET: SECRET })).toThrow(/CREDIT_TOMBSTONE_PEPPER/);
    expect(() => pepper({})).toThrow(/CREDIT_TOMBSTONE_PEPPER or BETTER_AUTH_SECRET/);
  });
});
