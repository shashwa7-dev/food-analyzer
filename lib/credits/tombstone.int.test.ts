import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDb, testDb } from "@/tests/helpers/db";
import { user } from "@/lib/db/auth-schema";
import { creditTombstone, creditTxn, profile, scan } from "@/lib/db/schema";
import { deleteAccount } from "@/lib/profile/service";
import { dailyCapHit, DAILY_AI_SCANS_PER_USER } from "@/lib/rate-limit";
import { debitForScan, ensureCurrentPeriod, getBalance, refundScan } from "./ledger";
import { emailHash, pruneTombstones } from "./tombstone";

const NOW = new Date("2026-10-07T10:00:00Z");

async function signUp(id: string, email: string) {
  await testDb().insert(user).values({ id, name: "T", email, emailVerified: true, createdAt: NOW, updatedAt: NOW });
  await testDb().insert(profile).values({ userId: id });
  return id;
}

/** n charged AI scans for `userId` at `at`, debited through the ledger like createScan does. */
async function chargedScans(userId: string, n: number, at = NOW) {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const [row] = await testDb().insert(scan).values({ userId, status: "done", imageCount: 1, engineVersion: "e", createdAt: at }).returning();
    await testDb().transaction((tx) => debitForScan(tx, userId, row!.id, at));
    ids.push(row!.id);
  }
  return ids;
}

describe("account deletion tombstone (final review I4)", () => {
  beforeEach(resetDb);

  it("signing up again with the same email keeps this month's used scans and today's count", async () => {
    const a = await signUp("u_a", "Priya@Example.com");
    expect((await getBalance(a, NOW)).credits).toBe(20);
    const [refunded] = await chargedScans(a, 6);
    await testDb().transaction((tx) => refundScan(tx, a, refunded!)); // refunded: credit back, still counts for the day
    expect((await getBalance(a, NOW)).credits).toBe(15);

    await deleteAccount(a, NOW);
    expect(await testDb().select().from(user).where(eq(user.id, a))).toHaveLength(0);

    // Stored without plain PII: just the HMAC and counts.
    const [t] = await testDb().select().from(creditTombstone);
    expect(t).toMatchObject({ emailHash: emailHash("priya@example.com"), period: "2026-10", used: 5, day: "2026-10-07", dayScans: 6 });
    expect(JSON.stringify(t)).not.toMatch(/priya/i);

    const b = await signUp("u_b", "  priya@example.com ");
    expect((await getBalance(b, NOW)).credits).toBe(15);
    const [grant] = await testDb().select().from(creditTxn).where(eq(creditTxn.userId, b));
    expect(grant).toMatchObject({ type: "grant", amount: 15, balanceAfter: 15, meta: { carriedOver: 5 } });
    const [p] = await testDb().select().from(profile).where(eq(profile.userId, b));
    expect(p).toMatchObject({ carriedDay: "2026-10-07", carriedDayScans: 6 });
  });

  it("today's carried count stops the new account at the 25/day cap; tomorrow it doesn't", async () => {
    const a = await signUp("u_a", "heavy@example.com");
    await testDb().update(profile).set({ plan: "pro" }).where(eq(profile.userId, a));
    await ensureCurrentPeriod(a, NOW);
    await chargedScans(a, DAILY_AI_SCANS_PER_USER);
    expect(await dailyCapHit(testDb(), a, NOW.getTime(), 300)).toBe("DAILY_LIMIT");
    await deleteAccount(a, NOW);

    const b = await signUp("u_b", "heavy@example.com");
    await ensureCurrentPeriod(b, NOW);
    expect(await dailyCapHit(testDb(), b, NOW.getTime(), 300)).toBe("DAILY_LIMIT");
    expect(await dailyCapHit(testDb(), b, NOW.getTime() + 24 * 3600_000, 300)).toBeNull();
  });

  it("a second deletion in the same period keeps the running total", async () => {
    const a = await signUp("u_a", "loop@example.com");
    await getBalance(a, NOW);
    await chargedScans(a, 5);
    await deleteAccount(a, NOW);
    const b = await signUp("u_b", "loop@example.com");
    await getBalance(b, NOW);
    await chargedScans(b, 2);
    await deleteAccount(b, NOW);
    const c = await signUp("u_c", "loop@example.com");
    expect((await getBalance(c, NOW)).credits).toBe(13);
  });

  it("never reduces a different email, or a new period", async () => {
    const a = await signUp("u_a", "old@example.com");
    await getBalance(a, NOW);
    await chargedScans(a, 20);
    await deleteAccount(a, NOW);

    expect((await getBalance(await signUp("u_other", "someone@example.com"), NOW)).credits).toBe(20);
    const nextMonth = new Date("2026-11-02T10:00:00Z");
    const b = await signUp("u_b", "old@example.com");
    expect((await getBalance(b, nextMonth)).credits).toBe(20);
    expect(await dailyCapHit(testDb(), b, nextMonth.getTime(), 300)).toBeNull();
  });

  it("the tombstone survives the user row (no FK), and deleting a user without a profile still works", async () => {
    await testDb().insert(user).values({ id: "u_bare", name: "T", email: "bare@example.com", emailVerified: true, createdAt: NOW, updatedAt: NOW });
    await deleteAccount("u_bare", NOW);
    expect(await testDb().select().from(user).where(eq(user.id, "u_bare"))).toHaveLength(0);
    const { rows } = await testDb().execute(sql`SELECT count(*)::int AS n FROM credit_tombstone`);
    expect((rows[0] as { n: number }).n).toBe(0);
  });
});

describe("tombstone retention (review N5)", () => {
  beforeEach(resetDb);
  const tomb = (emailHash: string, period: string, day: string) => ({ emailHash, period, used: 3, day, dayScans: 3 });

  it("pruneTombstones deletes only rows from before the current period", async () => {
    await testDb().insert(creditTombstone).values([tomb("old", "2026-09", "2026-09-30"), tomb("older", "2025-12", "2025-12-01"), tomb("now", "2026-10", "2026-10-01")]);
    expect(await pruneTombstones(NOW)).toBe(2);
    expect((await testDb().select().from(creditTombstone)).map((t) => t.emailHash)).toEqual(["now"]);
  });

  it("deleteAccount prunes stale rows after writing its own", async () => {
    await testDb().insert(creditTombstone).values(tomb("old", "2026-09", "2026-09-30"));
    const a = await signUp("u_a", "prune@example.com");
    await getBalance(a, NOW);
    await chargedScans(a, 1);
    await deleteAccount(a, NOW);
    const rows = await testDb().select().from(creditTombstone);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ emailHash: emailHash("prune@example.com"), period: "2026-10", used: 1 });
  });
});

describe("deleteAccount lock order (review N4)", () => {
  beforeEach(resetDb);

  it("waits on a running scan before taking the profile lock, so a failing job (scan → profile) can finish", async () => {
    const a = await signUp("u_a", "order@example.com");
    await getBalance(a, NOW);
    const [running] = await testDb().insert(scan).values({ userId: a, status: "processing", imageCount: 1, engineVersion: "e", createdAt: NOW }).returning();

    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    let locked!: () => void;
    const scanLocked = new Promise<void>((r) => { locked = r; });
    let profileLockedByJob = false;

    // The job, failScanTx-style: the conditional scan UPDATE first, the profile lock (refund) second.
    const job = testDb().transaction(async (tx) => {
      await tx.update(scan).set({ status: "failed", errorCode: "MODEL_ERROR" }).where(eq(scan.id, running!.id));
      locked();
      await gate;
      await tx.execute(sql`SELECT 1 FROM profile WHERE user_id = ${a} FOR UPDATE NOWAIT`); // throws if deleteAccount took it first
      profileLockedByJob = true;
    });
    await scanLocked;

    const deletion = deleteAccount(a, NOW);
    const deadline = Date.now() + 5000;
    for (;;) {
      const { rows } = await testDb().execute(sql`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`);
      if ((rows[0] as { n: number }).n > 0) break;
      if (Date.now() > deadline) throw new Error("deleteAccount never waited on the scan lock");
      await new Promise((r) => setTimeout(r, 20));
    }
    release();
    await job;
    await deletion;

    expect(profileLockedByJob).toBe(true);
    expect(await testDb().select().from(user).where(eq(user.id, a))).toHaveLength(0);
  });
});
