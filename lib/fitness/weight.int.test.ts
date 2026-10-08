import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createUser, resetDb } from "@/tests/helpers/db";
import { db } from "@/lib/db/client";
import { bodyWeight, profile } from "@/lib/db/schema";
import { addDays, todayIn } from "@/lib/dates";
import { deleteWeight, getWeightHistory, logWeight } from "./weight";
import { createWorkout, getWorkout } from "./service";

const today = () => todayIn("Asia/Kolkata");

/** A gym session on `date` through the service, no exercises, for burn recompute tests. */
function gym(userId: string, date: string, durationMin = 60) {
  return createWorkout(userId, { kind: "gym", date, durationMin, exercises: [] });
}

describe("body weight", () => {
  let me = "";
  let other = "";
  beforeEach(async () => {
    await resetDb();
    me = await createUser();
    other = await createUser();
  });

  it("upserts per date: a second log on the same day replaces the first", async () => {
    expect(await logWeight(me, { date: today(), kg: 72.4 })).toEqual({ date: today(), kg: 72.4 });
    expect(await logWeight(me, { date: today(), kg: 72.06 })).toEqual({ date: today(), kg: 72.06 });
    await logWeight(other, { date: today(), kg: 90 });
    const rows = await db.select().from(bodyWeight).where(eq(bodyWeight.userId, me));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.kg).toBe(72.06);
  });

  it("refuses an implausible weight or a date out of range", async () => {
    await expect(logWeight(me, { date: today(), kg: 5 })).rejects.toThrow();
    await expect(logWeight(me, { date: addDays(today(), 3), kg: 70 })).rejects.toThrow();
  });

  it("returns the user's history newest first with the latest, 30-day change and goal", async () => {
    await db.update(profile).set({ goalWeightKg: 68 }).where(eq(profile.userId, me));
    for (const [daysAgo, kg] of [[60, 80], [25, 74], [10, 73.2], [0, 72.4]] as const) await logWeight(me, { date: addDays(today(), -daysAgo), kg });
    await logWeight(other, { date: addDays(today(), -1), kg: 100 });
    const h = await getWeightHistory(me, { days: 30 });
    expect(h.entries.map((e) => e.kg)).toEqual([72.4, 73.2, 74]);
    expect(h.latest).toEqual({ date: today(), kg: 72.4 });
    expect(h.change30d).toBe(-1.6);
    expect(h.goalWeightKg).toBe(68);
    expect((await getWeightHistory(me)).entries).toHaveLength(4);
    expect(await getWeightHistory(await createUser())).toEqual({ entries: [], latest: null, change30d: null, goalWeightKg: null });
  });

  it("deletes one date, only the user's own", async () => {
    await logWeight(me, { date: today(), kg: 72 });
    await logWeight(other, { date: today(), kg: 90 });
    expect(await deleteWeight(me, "not-a-date")).toBe(false);
    expect(await deleteWeight(me, "2026-02-30")).toBe(false);
    expect(await deleteWeight(me, today())).toBe(true);
    expect(await deleteWeight(me, today())).toBe(false);
    expect(await db.select().from(bodyWeight)).toHaveLength(1);
  });

  it("recomputes a workout logged before any weigh-in once one is logged for that day", async () => {
    const w = await gym(me, today(), 60);
    expect(w).toMatchObject({ kcalBurned: 350, kcalBasis: { weightKg: 70, estimated: true } });
    await logWeight(me, { date: today(), kg: 92 });
    const after = await getWorkout(me, w.id);
    expect(after).toMatchObject({ kcalBurned: 460, kcalBasis: { weightKg: 92, estimated: false, minutes: 60 } });
  });

  it("re-logging an earlier weight recomputes only the workouts before the next weigh-in", async () => {
    const day1 = addDays(today(), -10);
    const day3 = addDays(today(), -8);
    const day5 = addDays(today(), -6);
    const day6 = addDays(today(), -5);
    await logWeight(me, { date: day1, kg: 80 });
    await logWeight(me, { date: day5, kg: 90 });
    const w3 = await gym(me, day3, 60);
    const w6 = await gym(me, day6, 60);
    expect(w3).toMatchObject({ kcalBurned: 400, kcalBasis: { weightKg: 80 } });
    expect(w6).toMatchObject({ kcalBurned: 450, kcalBasis: { weightKg: 90 } });

    await logWeight(me, { date: day1, kg: 70 });

    const w3After = await getWorkout(me, w3.id);
    const w6After = await getWorkout(me, w6.id);
    expect(w3After).toMatchObject({ kcalBurned: 350, kcalBasis: { weightKg: 70 } });
    expect(w6After).toMatchObject({ kcalBurned: 450, kcalBasis: { weightKg: 90 } }); // unchanged: day5's weight still applies
  });

  it("deleting a weigh-in falls later workouts back to the previous one", async () => {
    const day1 = addDays(today(), -10);
    const day3 = addDays(today(), -8);
    const day5 = addDays(today(), -6);
    const day6 = addDays(today(), -5);
    await logWeight(me, { date: day1, kg: 80 });
    await logWeight(me, { date: day5, kg: 90 });
    const w3 = await gym(me, day3, 60);
    const w6 = await gym(me, day6, 60);

    await deleteWeight(me, day5);

    const w3After = await getWorkout(me, w3.id);
    const w6After = await getWorkout(me, w6.id);
    expect(w3After).toMatchObject({ kcalBurned: 400, kcalBasis: { weightKg: 80 } }); // unaffected
    expect(w6After).toMatchObject({ kcalBurned: 400, kcalBasis: { weightKg: 80, estimated: false } }); // falls back to day1
  });

  it("only recomputes the acting user's workouts", async () => {
    const day = addDays(today(), -5);
    const otherW = await gym(other, day, 60);
    const mineW = await gym(me, day, 60);
    expect(otherW).toMatchObject({ kcalBurned: 350, kcalBasis: { weightKg: 70, estimated: true } });

    await logWeight(me, { date: day, kg: 92 });

    const otherAfter = await getWorkout(other, otherW.id);
    const mineAfter = await getWorkout(me, mineW.id);
    expect(otherAfter).toMatchObject({ kcalBurned: 350, kcalBasis: { weightKg: 70, estimated: true } });
    expect(mineAfter).toMatchObject({ kcalBurned: 460, kcalBasis: { weightKg: 92, estimated: false } });
  });
});
