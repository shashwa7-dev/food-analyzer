import { describe, expect, it } from "vitest";
import { databaseUrl } from "./client";

describe("databaseUrl", () => {
  it("rejects a missing or non-postgres URL with a clear message", () => {
    expect(() => databaseUrl(undefined)).toThrow(/DATABASE_URL is missing or invalid/);
    expect(() => databaseUrl("")).toThrow(/DATABASE_URL is missing or invalid/);
    expect(() => databaseUrl("not a url")).toThrow(/DATABASE_URL is missing or invalid/);
    expect(() => databaseUrl("mysql://x@localhost/db")).toThrow(/DATABASE_URL is missing or invalid/);
    expect(databaseUrl("postgres://u:p@localhost:5432/eatri8")).toBe("postgres://u:p@localhost:5432/eatri8");
  });
  it("does not connect or throw at import time", async () => {
    const mod = await import("./client");
    expect(mod.db).toBeDefined();
  });
});
