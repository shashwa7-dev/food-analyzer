import { describe, expect, it } from "vitest";
import { assertLocalDb } from "./local-guard";

describe("assertLocalDb", () => {
  it("allows a localhost database outside production", () => {
    expect(() => assertLocalDb("x", "postgres://u:p@localhost:5432/db", "development")).not.toThrow();
    expect(() => assertLocalDb("x", "postgres://u:p@127.0.0.1/db", undefined)).not.toThrow();
  });
  it("refuses production, remote hosts, host-overriding params and a missing URL", () => {
    expect(() => assertLocalDb("x", "postgres://localhost/db", "production")).toThrow(/production/);
    expect(() => assertLocalDb("x", "postgres://u:p@db.neon.tech/db", "development")).toThrow(/local database/);
    expect(() => assertLocalDb("x", "postgres://localhost/db?host=evil.example", "development")).toThrow(/local database/);
    expect(() => assertLocalDb("x", "postgres://localhost/db?HostAddr=1.2.3.4", "development")).toThrow(/local database/);
    expect(() => assertLocalDb("x", undefined, "development")).toThrow(/local database/);
  });
});
