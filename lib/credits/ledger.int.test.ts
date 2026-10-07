import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createUser, resetDb, testDb } from "@/tests/helpers/db";
import { creditTxn, profile, scan } from "@/lib/db/schema";
import {
  NoCreditsError, ScanNotFoundError, debitForScan, ensureCurrentPeriod, getBalance, listTransactions, refundScan,
} from "./ledger";

const NOW = new Date("2026-10-05T00:00:00Z");

async function insertScan(userId: string) {
  const [row] = await testDb().insert(scan).values({ userId, status: "queued", imageCount: 1, engineVersion: "e1" }).returning();
  return row!.id;
}

describe("credits/ledger", () => {
  beforeEach(resetDb);

  describe("getBalance / ensureCurrentPeriod", () => {
    it("grants the plan allowance on first check and is idempotent on repeat checks", async () => {
      const u = await createUser();

      const b1 = await getBalance(u, NOW);
      expect(b1.credits).toBe(20);
      expect(b1.allowance).toBe(20);
      expect(b1.periodResetsAt.toISOString()).toBe("2026-11-01T00:00:00.000Z");

      const txns1 = await testDb().select().from(creditTxn).where(eq(creditTxn.userId, u));
      expect(txns1).toHaveLength(1);
      expect(txns1[0]!.type).toBe("grant");
      expect(txns1[0]!.amount).toBe(20);

      const b2 = await getBalance(u, NOW);
      expect(b2.credits).toBe(20);
      const txns2 = await testDb().select().from(creditTxn).where(eq(creditTxn.userId, u));
      expect(txns2).toHaveLength(1);
    });

    it("expires the old balance and grants a new one on month rollover, exactly once under concurrency", async () => {
      const u = await createUser();
      await testDb().update(profile).set({ allowancePeriod: "2026-09", credits: 7 }).where(eq(profile.userId, u));

      const results = await Promise.all(Array.from({ length: 10 }, () => ensureCurrentPeriod(u, NOW)));
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

    it("does not reset when the stored period is ahead of now (clock-skew guard, monotonic reset)", async () => {
      const u = await createUser();
      await testDb().update(profile).set({ allowancePeriod: "2026-11", credits: 5 }).where(eq(profile.userId, u));

      const result = await ensureCurrentPeriod(u, NOW); // real period is "2026-10", stored is "2026-11"
      expect(result.period).toBe("2026-10");
      expect(result.credits).toBe(5);

      const [p] = await testDb().select().from(profile).where(eq(profile.userId, u));
      expect(p!.allowancePeriod).toBe("2026-11");
      expect(p!.credits).toBe(5);
      const txns = await testDb().select().from(creditTxn).where(eq(creditTxn.userId, u));
      expect(txns).toHaveLength(0);
    });
  });

  describe("debitForScan", () => {
    it("resets a fresh user's allowance before debiting (reset-on-spend), succeeding with balance 19", async () => {
      const u = await createUser();
      const scanId = await insertScan(u);

      const result = await testDb().transaction((tx) => debitForScan(tx, u, scanId, NOW));
      expect(result.balanceAfter).toBe(19);

      const [p] = await testDb().select().from(profile).where(eq(profile.userId, u));
      expect(p!.credits).toBe(19);
      expect(p!.allowancePeriod).toBe("2026-10");

      const grants = await testDb().select().from(creditTxn).where(and(eq(creditTxn.userId, u), eq(creditTxn.type, "grant")));
      expect(grants).toHaveLength(1);
      const debits = await testDb().select().from(creditTxn).where(and(eq(creditTxn.userId, u), eq(creditTxn.type, "debit")));
      expect(debits).toHaveLength(1);
    });

    it("debits once per scan even when called twice (idempotent)", async () => {
      const u = await createUser();
      await getBalance(u, NOW);
      const scanId = await insertScan(u);

      const r1 = await testDb().transaction((tx) => debitForScan(tx, u, scanId, NOW));
      const r2 = await testDb().transaction((tx) => debitForScan(tx, u, scanId, NOW));
      expect(r1.balanceAfter).toBe(19);
      expect(r2.balanceAfter).toBe(19);

      const debits = await testDb().select().from(creditTxn).where(and(eq(creditTxn.userId, u), eq(creditTxn.type, "debit")));
      expect(debits).toHaveLength(1);

      const [p] = await testDb().select().from(profile).where(eq(profile.userId, u));
      expect(p!.credits).toBe(19);

      const [s] = await testDb().select().from(scan).where(eq(scan.id, scanId));
      expect(s!.charged).toBe(true);
    });

    it("throws NoCreditsError and leaves no debit row when the current-period balance is already zero", async () => {
      const u = await createUser();
      await testDb().update(profile).set({ allowancePeriod: "2026-10", credits: 0 }).where(eq(profile.userId, u));
      const scanId = await insertScan(u);

      await expect(testDb().transaction((tx) => debitForScan(tx, u, scanId, NOW))).rejects.toThrow(NoCreditsError);

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
        testDb().transaction((tx) => debitForScan(tx, u, scanA, NOW)),
        testDb().transaction((tx) => debitForScan(tx, u, scanB, NOW)),
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

    it("throws ScanNotFoundError when debiting a scan owned by a different user, writing nothing", async () => {
      const owner = await createUser();
      const attacker = await createUser();
      await testDb().update(profile).set({ credits: 20, allowancePeriod: "2026-10" }).where(eq(profile.userId, attacker));
      const scanId = await insertScan(owner);

      await expect(testDb().transaction((tx) => debitForScan(tx, attacker, scanId, NOW))).rejects.toThrow(ScanNotFoundError);

      const [p] = await testDb().select().from(profile).where(eq(profile.userId, attacker));
      expect(p!.credits).toBe(20);
      const txns = await testDb().select().from(creditTxn).where(eq(creditTxn.userId, attacker));
      expect(txns).toHaveLength(0);
      const [s] = await testDb().select().from(scan).where(eq(scan.id, scanId));
      expect(s!.charged).toBe(false);
    });

    it("keeps the ledger sum equal to the profile balance when a reset races a debit from a stale period", async () => {
      const u = await createUser();
      // Seed via a real ledger row (not a bare credits= override) so the sum-equals-balance
      // invariant holds from the start, not just across the race being asserted.
      await testDb().insert(creditTxn).values({ userId: u, amount: 3, type: "grant", idempotencyKey: `grant:${u}:2026-09`, balanceAfter: 3 });
      await testDb().update(profile).set({ allowancePeriod: "2026-09", credits: 3 }).where(eq(profile.userId, u));
      const scanId = await insertScan(u);

      await Promise.all([
        ensureCurrentPeriod(u, NOW),
        testDb().transaction((tx) => debitForScan(tx, u, scanId, NOW)),
      ]);

      const [p] = await testDb().select().from(profile).where(eq(profile.userId, u));
      const txns = await testDb().select().from(creditTxn).where(eq(creditTxn.userId, u));
      const sum = txns.reduce((acc, t) => acc + t.amount, 0);
      expect(sum).toBe(p!.credits);
    });
  });

  describe("refundScan", () => {
    it("refunds once per scan (idempotent) and is a no-op the second time", async () => {
      const u = await createUser();
      await testDb().update(profile).set({ credits: 5, allowancePeriod: "2026-10" }).where(eq(profile.userId, u));
      const scanId = await insertScan(u);
      await testDb().transaction((tx) => debitForScan(tx, u, scanId, NOW)); // credits -> 4, scan.charged = true

      const r1 = await testDb().transaction((tx) => refundScan(tx, u, scanId));
      const r2 = await testDb().transaction((tx) => refundScan(tx, u, scanId));
      expect(r1).toBe(true);
      expect(r2).toBe(false);

      const [p] = await testDb().select().from(profile).where(eq(profile.userId, u));
      expect(p!.credits).toBe(5);

      const refunds = await testDb().select().from(creditTxn).where(and(eq(creditTxn.userId, u), eq(creditTxn.type, "refund")));
      expect(refunds).toHaveLength(1);
      expect(refunds[0]!.amount).toBe(1);
      expect(refunds[0]!.balanceAfter).toBe(5);
    });

    it("returns false and leaves the balance unchanged when refunding a never-charged scan", async () => {
      const u = await createUser();
      await testDb().update(profile).set({ credits: 5 }).where(eq(profile.userId, u));
      const scanId = await insertScan(u);

      const refunded = await testDb().transaction((tx) => refundScan(tx, u, scanId));
      expect(refunded).toBe(false);

      const [p] = await testDb().select().from(profile).where(eq(profile.userId, u));
      expect(p!.credits).toBe(5);
      const refunds = await testDb().select().from(creditTxn).where(eq(creditTxn.userId, u));
      expect(refunds).toHaveLength(0);
    });

    it("does not clear scan.charged after a refund", async () => {
      const u = await createUser();
      await testDb().update(profile).set({ credits: 5, allowancePeriod: "2026-10" }).where(eq(profile.userId, u));
      const scanId = await insertScan(u);
      await testDb().transaction((tx) => debitForScan(tx, u, scanId, NOW));

      await testDb().transaction((tx) => refundScan(tx, u, scanId));

      const [s] = await testDb().select().from(scan).where(eq(scan.id, scanId));
      expect(s!.charged).toBe(true);
    });

    it("composes with debitForScan in one transaction for a mark-failed-and-refund flow", async () => {
      const u = await createUser();
      await testDb().update(profile).set({ credits: 20, allowancePeriod: "2026-10" }).where(eq(profile.userId, u));
      const scanId = await insertScan(u);

      await testDb().transaction((tx) => debitForScan(tx, u, scanId, NOW));
      const refunded = await testDb().transaction((tx) => refundScan(tx, u, scanId));
      expect(refunded).toBe(true);

      const [p] = await testDb().select().from(profile).where(eq(profile.userId, u));
      expect(p!.credits).toBe(20);
    });

    it("throws ScanNotFoundError when refunding a scan owned by a different user, writing nothing", async () => {
      const owner = await createUser();
      const attacker = await createUser();
      await testDb().update(profile).set({ credits: 20, allowancePeriod: "2026-10" }).where(eq(profile.userId, owner));
      const scanId = await insertScan(owner);
      await testDb().transaction((tx) => debitForScan(tx, owner, scanId, NOW)); // owner: 19

      await expect(testDb().transaction((tx) => refundScan(tx, attacker, scanId))).rejects.toThrow(ScanNotFoundError);

      const [p] = await testDb().select().from(profile).where(eq(profile.userId, owner));
      expect(p!.credits).toBe(19);
      const refunds = await testDb().select().from(creditTxn).where(and(eq(creditTxn.userId, attacker), eq(creditTxn.type, "refund")));
      expect(refunds).toHaveLength(0);
    });
  });

  describe("listTransactions", () => {
    it("lists a user's transactions most-recent first, limited", async () => {
      const u = await createUser();
      await getBalance(u, NOW);
      const scanId = await insertScan(u);
      await testDb().transaction((tx) => debitForScan(tx, u, scanId, NOW));

      const txns = await listTransactions(u);
      expect(txns).toHaveLength(2);
      expect(txns[0]!.type).toBe("debit");
      expect(txns[1]!.type).toBe("grant");

      const limited = await listTransactions(u, 1);
      expect(limited).toHaveLength(1);
    });

    it("orders a tied grant/expire pair from the same reset with grant first", async () => {
      const u = await createUser();
      await testDb().update(profile).set({ allowancePeriod: "2026-09", credits: 7 }).where(eq(profile.userId, u));
      await ensureCurrentPeriod(u, NOW);

      const txns = await listTransactions(u);
      expect(txns).toHaveLength(2);
      expect(txns[0]!.type).toBe("grant");
      expect(txns[1]!.type).toBe("expire");
      expect(txns[0]!.createdAt.getTime()).toBe(txns[1]!.createdAt.getTime());
    });

    it("clamps limit to the 1-100 range", async () => {
      const u = await createUser();
      await getBalance(u, NOW);

      const zero = await listTransactions(u, 0);
      expect(zero).toHaveLength(1);
      const many = await listTransactions(u, 9999);
      expect(many.length).toBeLessThanOrEqual(100);
    });
  });
});
