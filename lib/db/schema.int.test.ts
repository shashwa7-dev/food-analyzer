import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createUser, resetDb, testDb } from "@/tests/helpers/db";
import { profile } from "./schema";

describe("schema", () => {
  beforeEach(resetDb);
  it("has pg_trgm installed", async () => {
    const r = await testDb().execute(sql`SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'`);
    expect(r.rows.length).toBe(1);
  });
  it("rejects negative credits", async () => {
    const id = await createUser();
    await expect(testDb().update(profile).set({ credits: -1 })).rejects.toThrow();
    expect(id).toBeTruthy();
  });
});
