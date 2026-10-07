import { beforeEach, describe, expect, it } from "vitest";
import { createUser, resetDb, testDb } from "@/tests/helpers/db";
import { creditTxn, scan, waitlist } from "./schema";

describe("m2 schema", () => {
  beforeEach(resetDb);
  it("enforces unique credit idempotency keys", async () => {
    const u = await createUser();
    const row = { userId: u, amount: 20, type: "grant" as const, idempotencyKey: `grant:${u}:2026-10`, balanceAfter: 20 };
    await testDb().insert(creditTxn).values(row);
    await expect(testDb().insert(creditTxn).values(row)).rejects.toThrow();
  });
  it("cascades scans and waitlist on user delete", async () => {
    const u = await createUser();
    await testDb().insert(scan).values({ userId: u, status: "queued", imageCount: 1, engineVersion: "e1" });
    await testDb().insert(waitlist).values({ userId: u });
    const { user } = await import("./auth-schema");
    const { eq } = await import("drizzle-orm");
    await testDb().delete(user).where(eq(user.id, u));
    expect(await testDb().select().from(scan)).toHaveLength(0);
    expect(await testDb().select().from(waitlist)).toHaveLength(0);
  });
});
