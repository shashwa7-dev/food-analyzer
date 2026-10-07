import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createUser, resetDb, testDb } from "@/tests/helpers/db";
import { creditTxn, profile, scan } from "@/lib/db/schema";
import {
  NoCreditsError, debitForScan, ensureCurrentPeriod, getBalance, listTransactions, refundScan, refundScanStandalone,
} from "./ledger";

async function insertScan(userId: string) {
  const [row] = await testDb().insert(scan).values({ userId, status: "queued", imageCount: 1, engineVersion: "e1" }).returning();
  return row!.id;
}

describe("credits/ledger", () => {
  beforeEach(resetDb);

  describe("getBalance / ensureCurrentPeriod", () => {
    it("grants the plan allowance on first check and is idempotent on repeat checks", async () => {
      const u = await createUser();
      const now = new Date("2026-10-05T00:00:00Z");

      const b1 = await getBalance(u, now);
      expect(b1.credits).toBe(20);
      expect(b1.allowance).toBe(20);
      expect(b1.periodResetsAt.toISOString()).toBe("2026-11-01T00:00:00.000Z");

      const txns1 = await testDb().select().from(creditTxn).where(eq(creditTxn.userId, u));
      expect(txns1).toHaveLength(1);
      expect(txns1[0]!.type).toBe("grant");
      expect(txns1[0]!.amount).toBe(20);

      const b2 = await getBalance(u, now);
      expect(b2.credits).toBe(20);
      const txns2 = await testDb().select().from(creditTxn).where(eq(creditTxn.userId, u));
      expect(txns2).toHaveLength(1);
    });

    it("expires the old balance and grants a new one on month rollover, exactly once under concurrency", async () => {
      const u = await createUser();
      await testDb().update(profile).set({ allowancePeriod: "2026-09", credits: 7 }).where(eq(profile.userId, u));
      const now = new Date("2026-10-05T00:00:00Z");

      const results = await Promise.all(Array.from({ length: 10 }, () => ensureCurrentPeriod(u, now)));
      for (const r of results) expect(r.period).toBe("2026-10");

      const [p] = await testDb().select().from(profile).where(eq(profile.userId, u));
      expect(p!.credits).toBe(20);
      expect(p!.allowancePeriod).toBe("2026-10");

      const txns = await testDb().select().from(creditTxn).where(eq(creditTxn.userId, u));
      const expires = txns.filter((t) => t.type === "expire");
      const grants = txns.filter((t) => t.type === "grant");
      expect(expires).toHaveLength(1);
      expect(expires[0]!.amount).toBe(-7);
      expect(expires[0]!.idempotencyKey).toBe(`expire:${u}:2026-09`);
      expect(grants).toHaveLength(1);
      expect(grants[0]!.amount).toBe(20);
      expect(grants[0]!.idempotencyKey).toBe(`grant:${u}:2026-10`);
    });
  });

  describe("debitForScan", () => {
    it("debits once per scan even when called twice (idempotent)", async () => {
      const u = await createUser();
      await getBalance(u, new Date("2026-10-05T00:00:00Z"));
      const scanId = await insertScan(u);

      const r1 = await testDb().transaction((tx) => debitForScan(tx, u, scanId));
      const r2 = await testDb().transaction((tx) => debitForScan(tx, u, scanId));
      expect(r1.balanceAfter).toBe(19);
      expect(r2.balanceAfter).toBe(19);

      const debits = await testDb().select().from(creditTxn).where(and(eq(creditTxn.userId, u), eq(creditTxn.type, "debit")));
      expect(debits).toHaveLength(1);

      const [p] = await testDb().select().from(profile).where(eq(profile.userId, u));
      expect(p!.credits).toBe(19);

      const [s] = await testDb().select().from(scan).where(eq(scan.id, scanId));
      expect(s!.charged).toBe(true);
    });

    it("throws NoCreditsError and leaves no txn row when the balance is zero", async () => {
      const u = await createUser();
      const scanId = await insertScan(u);

      await expect(testDb().transaction((tx) => debitForScan(tx, u, scanId))).rejects.toThrow(NoCreditsError);

      const txns = await testDb().select().from(creditTxn).where(eq(creditTxn.userId, u));
      expect(txns).toHaveLength(0);
      const [p] = await testDb().select().from(profile).where(eq(profile.userId, u));
      expect(p!.credits).toBe(0);
    });

    it("lets exactly one of two concurrently debited scans succeed when only one credit remains", async () => {
      const u = await createUser();
      await testDb().update(profile).set({ credits: 1, allowancePeriod: "2026-10" }).where(eq(profile.userId, u));
      const scanA = await insertScan(u);
      const scanB = await insertScan(u);

      const results = await Promise.allSettled([
        testDb().transaction((tx) => debitForScan(tx, u, scanA)),
        testDb().transaction((tx) => debitForScan(tx, u, scanB)),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]!.reason).toBeInstanceOf(NoCreditsError);

      const [p] = await testDb().select().from(profile).where(eq(profile.userId, u));
      expect(p!.credits).toBe(0);

      const debits = await testDb().select().from(creditTxn).where(and(eq(creditTxn.userId, u), eq(creditTxn.type, "debit")));
      expect(debits).toHaveLength(1);
    });
  });

  describe("refundScan", () => {
    it("refunds once per scan (idempotent) and is a no-op the second time", async () => {
      const u = await createUser();
      await testDb().update(profile).set({ credits: 5 }).where(eq(profile.userId, u));
      const scanId = await insertScan(u);

      const r1 = await refundScanStandalone(u, scanId);
      const r2 = await refundScanStandalone(u, scanId);
      expect(r1).toBe(true);
      expect(r2).toBe(false);

      const [p] = await testDb().select().from(profile).where(eq(profile.userId, u));
      expect(p!.credits).toBe(6);

      const refunds = await testDb().select().from(creditTxn).where(and(eq(creditTxn.userId, u), eq(creditTxn.type, "refund")));
      expect(refunds).toHaveLength(1);
      expect(refunds[0]!.amount).toBe(1);
      expect(refunds[0]!.balanceAfter).toBe(6);
    });

    it("composes with debitForScan in one transaction for a mark-failed-and-refund flow", async () => {
      const u = await createUser();
      await testDb().update(profile).set({ credits: 20, allowancePeriod: "2026-10" }).where(eq(profile.userId, u));
      const scanId = await insertScan(u);

      await testDb().transaction((tx) => debitForScan(tx, u, scanId));
      const refunded = await testDb().transaction((tx) => refundScan(tx, u, scanId));
      expect(refunded).toBe(true);

      const [p] = await testDb().select().from(profile).where(eq(profile.userId, u));
      expect(p!.credits).toBe(20);
    });
  });

  describe("listTransactions", () => {
    it("lists a user's transactions most-recent first, limited", async () => {
      const u = await createUser();
      await getBalance(u, new Date("2026-10-05T00:00:00Z"));
      const scanId = await insertScan(u);
      await testDb().transaction((tx) => debitForScan(tx, u, scanId));

      const txns = await listTransactions(u);
      expect(txns).toHaveLength(2);
      expect(txns[0]!.type).toBe("debit");
      expect(txns[1]!.type).toBe("grant");

      const limited = await listTransactions(u, 1);
      expect(limited).toHaveLength(1);
    });
  });
});
