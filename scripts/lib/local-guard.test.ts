import { afterEach, describe, expect, it, vi } from "vitest";
import { assertLocalDb } from "./local-guard";

describe("assertLocalDb", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("allows a localhost database outside production", () => {
    expect(() => assertLocalDb("x", "postgres://u:p@localhost:5432/db", "development")).not.toThrow();
    expect(() => assertLocalDb("x", "postgres://u:p@127.0.0.1/db", undefined)).not.toThrow();
  });
  it("refuses production, remote hosts, host-overriding params and a missing URL", () => {
    expect(() => assertLocalDb("x", "postgres://localhost/db", "production")).toThrow(/production/);
    expect(() => assertLocalDb("x", "postgres://u:p@db.neon.tech/db", "development")).toThrow(/local database/);
    expect(() => assertLocalDb("x", "postgres://localhost/db?host=evil.example", "development")).toThrow(/local database/);
    expect(() => assertLocalDb("x", "postgres://localhost/db?HostAddr=1.2.3.4", "development")).toThrow(/local database/);
    expect(() => assertLocalDb("x", "", "development")).toThrow(/local database/);
  });
  it("reads DATABASE_URL when no URL is passed, and refuses when that is unset too", () => {
    // Passing undefined means "use the environment", so the environment has to be pinned here: CI
    // sets DATABASE_URL to its local test database, a developer's shell may not set it at all.
    vi.stubEnv("DATABASE_URL", undefined);
    expect(() => assertLocalDb("x", undefined, "development")).toThrow(/local database/);
    vi.stubEnv("DATABASE_URL", "postgres://u:p@db.neon.tech/db");
    expect(() => assertLocalDb("x", undefined, "development")).toThrow(/local database/);
    vi.stubEnv("DATABASE_URL", "postgres://u:p@localhost:5432/db");
    expect(() => assertLocalDb("x", undefined, "development")).not.toThrow();
  });
});
