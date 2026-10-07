import { and, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createUser, resetDb, testDb } from "@/tests/helpers/db";
import { creditTxn, profile, scan } from "@/lib/db/schema";
import { InvalidError } from "@/lib/errors";
import {
  NoCreditsError, ScanNotFoundError, countActivity, debitForScan, ensureCurrentPeriod, getBalance, listActivity, periodBalances, refundScan,
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

  describe("listActivity", () => {
    type ScanInsert = typeof scan.$inferInsert;
    async function addScan(userId: string, v: Partial<ScanInsert> & { name?: string; grade?: string }) {
      const { name, grade, ...rest } = v;
      const result = name ? ({ name, grade: grade ?? null } as unknown as ScanInsert["result"]) : undefined;
      const [row] = await testDb().insert(scan).values({ userId, status: "done", imageCount: 1, engineVersion: "e1", result, ...rest }).returning();
      return row!.id;
    }
    const charge = (userId: string, scanId: string) => testDb().transaction((tx) => debitForScan(tx, userId, scanId, NOW));

    /** The demo-like month: grant, a free barcode, a label scan, a failed-and-refunded meal photo, a later-deleted scan. */
    async function seedMonth(u: string) {
      await getBalance(u, NOW);
      const milk = await addScan(u, { inputKind: "barcode", barcode: "8901262010016", charged: false, name: "Amul Taaza Milk", grade: "B" });
      const peanuts = await addScan(u, { inputKind: "label", name: "Masala Peanuts", grade: "D" });
      await charge(u, peanuts);
      const meal = await addScan(u, { inputKind: "meal", status: "failed", errorCode: "UNREADABLE" });
      await charge(u, meal);
      await testDb().transaction((tx) => refundScan(tx, u, meal));
      const gone = await addScan(u, { inputKind: "label", name: "Aloo Bhujia", grade: "E" });
      await charge(u, gone);
      await testDb().update(scan).set({ deletedAt: new Date() }).where(eq(scan.id, gone));
      return { milk, peanuts, meal, gone };
    }

    it("lists grants, used scans, free barcodes and refunds newest first, hiding a refunded scan's debit", async () => {
      const u = await createUser();
      const ids = await seedMonth(u);

      const { items, nextCursor } = await listActivity(u, "all");
      expect(nextCursor).toBeNull();
      expect(items.map((i) => i.kind)).toEqual(["used", "refund", "used", "free", "grant"]);
      expect(items.map((i) => i.title)).toEqual(["Aloo Bhujia", "Couldn't read photo", "Masala Peanuts", "Amul Taaza Milk", "October allowance"]);
      expect(items.map((i) => i.meta)).toEqual(["Label · grade E · deleted", "Refunded automatically", "Label · grade D", "Barcode · grade B", "Monthly AI scans"]);
      expect(items.map((i) => i.amount)).toEqual([-1, 1, -1, 0, 20]);
      expect(items.map((i) => i.scanId)).toEqual([ids.gone, ids.meal, ids.peanuts, ids.milk, null]);
      expect(items.map((i) => i.linkable)).toEqual([false, true, true, true, false]);
      for (const i of items) expect(Number.isNaN(Date.parse(i.at))).toBe(false);
    });

    it("filters to used, free or refund rows", async () => {
      const u = await createUser();
      const ids = await seedMonth(u);

      expect((await listActivity(u, "used")).items.map((i) => i.scanId)).toEqual([ids.gone, ids.peanuts]);
      const free = await listActivity(u, "free");
      expect(free.items.map((i) => [i.kind, i.title])).toEqual([["free", "Amul Taaza Milk"]]);
      const refunds = await listActivity(u, "refunds");
      expect(refunds.items.map((i) => [i.kind, i.scanId])).toEqual([["refund", ids.meal]]);
    });

    it("leaves the grade out of meta when there is none, and counts a meal photo's items instead", async () => {
      const u = await createUser();
      await getBalance(u, NOW);
      const front = await addScan(u, { inputKind: "front", name: "Mystery Bar" });
      await charge(u, front);
      const thali = await addScan(u, { inputKind: "meal", name: "Thali photo" });
      await testDb().update(scan).set({ result: sql`jsonb_build_object('name', 'Thali photo', 'grade', null, 'items', '[1,2,3,4]'::jsonb)` }).where(eq(scan.id, thali));
      await charge(u, thali);

      const { items } = await listActivity(u, "used");
      expect(items.map((i) => i.meta)).toEqual(["Meal photo · 4 items", "Front of pack"]);
    });

    it("never shows another user's rows", async () => {
      const u = await createUser();
      const other = await createUser();
      await seedMonth(other);
      await getBalance(u, NOW);

      const { items } = await listActivity(u, "all");
      expect(items.map((i) => i.kind)).toEqual(["grant"]);
      expect(await countActivity(u, NOW)).toEqual({ used: 0, free: 0, refunded: 0 });
    });

    it("pages 30 at a time with a keyset cursor that never skips or repeats rows sharing a timestamp", async () => {
      const u = await createUser();
      await getBalance(u, NOW);
      // One statement: every row gets the same now(), so only the cursor's tie-breakers keep pages apart.
      await testDb().insert(scan).values(Array.from({ length: 32 }, (_, i) => ({
        userId: u, status: "done" as const, imageCount: 0, engineVersion: "e1", inputKind: "barcode" as const, barcode: `89000000000${i}`,
        result: { name: `Pack ${i}`, grade: "C" } as unknown as ScanInsert["result"],
      })));

      const p1 = await listActivity(u, "all");
      expect(p1.items).toHaveLength(30);
      expect(p1.nextCursor).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z~1~[0-9a-f-]{36}$/);
      const p2 = await listActivity(u, "all", p1.nextCursor!);
      expect(p2.nextCursor).toBeNull();
      expect(p2.items.map((i) => i.kind)).toEqual(["free", "free", "grant"]);
      const all = [...p1.items, ...p2.items].map((i) => i.id);
      expect(new Set(all).size).toBe(33);
    });

    it("rejects a malformed cursor", async () => {
      const u = await createUser();
      await expect(listActivity(u, "all", "nope")).rejects.toThrow(InvalidError);
      await expect(listActivity(u, "all", "2026-10-05T00:00:00.000000Z~2~00000000-0000-0000-0000-000000000000")).rejects.toThrow(InvalidError);
    });

    it("counts this period's used, free and refunded scans for the stat tiles", async () => {
      const u = await createUser();
      await seedMonth(u);
      expect(await countActivity(u, new Date())).toEqual({ used: 2, free: 1, refunded: 1 });
    });

    it("lists this period's balance changes oldest first, the grant before a debit in its own transaction", async () => {
      const u = await createUser();
      const first = await insertScan(u);
      await testDb().transaction((tx) => debitForScan(tx, u, first)); // grants, then debits, in one transaction

      const b = await periodBalances(u);
      expect(b.map((r) => [r.type, r.balanceAfter])).toEqual([["grant", 20], ["debit", 19]]);
      expect(b[0]!.at).toBe(b[1]!.at);
    });
  });
});
