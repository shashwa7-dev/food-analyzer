import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { createUser, resetDb, testDb } from "@/tests/helpers/db";
import { db } from "@/lib/db/client";
import { bodyWeight, profile, workout, workoutExercise, workoutSet } from "@/lib/db/schema";
import { addDays, todayIn } from "@/lib/dates";
import { ProRequiredError } from "@/lib/errors";
import { completeFitnessSetup, deleteWorkout, getFitnessStats, historyPage } from "@/lib/fitness/service";

const today = () => todayIn("Asia/Kolkata");

/** A bare gym workout row, inserted directly so startedAt/createdAt/preset are fully controlled. */
async function insertGym(opts: { userId: string; date: string; startedAt: Date; preset?: "push" | "pull" | "legs" | "back" | "shoulders" | null; createdAt?: Date }) {
  const [row] = await db.insert(workout).values({
    userId: opts.userId, date: opts.date, kind: "gym", preset: opts.preset ?? null, title: "Workout", intensity: "moderate",
    startedAt: opts.startedAt, durationMin: 45, kcalBurned: 300, kcalBasis: { met: 5, weightKg: 70, estimated: true, minutes: 45 },
    ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
  }).returning({ id: workout.id });
  return row!.id;
}

/** One done set of `bench_press` on a workout, weightKg × reps = volume. */
async function addBench(workoutId: string, weightKg: number, reps: number) {
  const [ex] = await db.insert(workoutExercise).values({ workoutId, position: 0, exerciseKey: "bench_press", name: "Bench press" }).returning({ id: workoutExercise.id });
  await db.insert(workoutSet).values({ exerciseId: ex!.id, position: 0, weightKg, reps, done: true });
}

describe("fitness insights service", () => {
  beforeEach(resetDb);
  afterEach(() => vi.unstubAllEnvs());

  it("scopes stats to the owner: another user's workouts never show", async () => {
    const a = await createUser();
    const b = await createUser();
    const wa = await insertGym({ userId: a, date: today(), startedAt: new Date(), preset: "push" });
    await addBench(wa, 60, 8);

    const stats = await getFitnessStats(b, "week");
    expect(stats.hasWorkouts).toBe(false);
    expect(stats.tiles.workoutDays.value).toBe(0);
    expect(stats.tiles.minutes.value).toBe(0);
    expect(stats.tiles.kcal.value).toBe(0);
    expect(stats.tiles.volumeKg.value).toBe(0);
    expect(stats.tiles.prs.value).toBe(0);
  });

  it("soft delete: a deleted workout counts nowhere (volume, calendar, history, PRs)", async () => {
    const me = await createUser();
    // A baseline PR, well outside the current week/month, so it never affects period totals.
    const baseline = await insertGym({ userId: me, date: addDays(today(), -40), startedAt: new Date("2026-01-01T06:00:00Z"), preset: "pull" });
    await addBench(baseline, 40, 5); // e1rm ~46.7, not a PR itself (first ever)

    const deleted = await insertGym({ userId: me, date: today(), startedAt: new Date("2026-01-02T06:00:00Z"), preset: "legs" });
    await addBench(deleted, 100, 5); // heavier: would raise the bar if counted

    const kept = await insertGym({ userId: me, date: today(), startedAt: new Date("2026-01-02T08:00:00Z"), preset: "push" });
    await addBench(kept, 50, 5); // lighter than the deleted one, but a PR once it's excluded

    expect(await deleteWorkout(me, deleted)).toBe(true);

    const stats = await getFitnessStats(me, "week");
    expect(stats.tiles.volumeKg.value).toBe(250); // only kept: 50 * 5
    expect(stats.tiles.prs.value).toBe(1); // kept's bench beats the baseline once the deleted one is excluded
    expect(stats.calendar?.days.find((d) => d.date === today())?.type).toBe("push"); // kept's preset, not the deleted one's

    const page = await historyPage(me, null, 20);
    expect(page.items.map((i) => i.id)).toEqual([kept, baseline]);
    expect(page.items.some((i) => i.id === deleted)).toBe(false);
  });

  it("gates Month behind Pro once PRO_GATES_ENFORCED is on, locking week's extras for Basic", async () => {
    const me = await createUser();
    vi.stubEnv("PRO_GATES_ENFORCED", "true");

    await expect(getFitnessStats(me, "month")).rejects.toThrow(ProRequiredError);

    const week = await getFitnessStats(me, "week");
    expect(week.locked).toBe(true);
    expect(week.calendar).toBeNull();
    expect(week.volume).toBeNull();
    expect(week.topExercises).toBeNull();
    expect(week.byType).toBeNull();

    await db.update(profile).set({ plan: "pro" }).where(eq(profile.userId, me));
    const month = await getFitnessStats(me, "month");
    expect(month.locked).toBe(false);
    expect(month.calendar).not.toBeNull();
  });

  it("opens every field for Basic while the gates are off", async () => {
    const me = await createUser();
    const w = await insertGym({ userId: me, date: today(), startedAt: new Date(), preset: "push" });
    await addBench(w, 60, 8);

    const stats = await getFitnessStats(me, "month");
    expect(stats.locked).toBe(false);
    expect(stats.calendar).not.toBeNull();
    expect(stats.volume).not.toBeNull();
    expect(stats.topExercises).not.toBeNull();
    expect(stats.byType).not.toBeNull();
  });

  describe("historyPage", () => {
    it("pages 25 workouts newest first with no duplicates, even with ties, and a garbage cursor acts like null", async () => {
      const me = await createUser();
      const ids: string[] = [];
      // Two workouts sharing the same date, startedAt AND createdAt: the id tiebreak must still split them.
      const tieAt = new Date("2026-03-01T06:00:00Z");
      const tieCreated = new Date("2026-03-01T06:00:01Z");
      for (let i = 0; i < 2; i++) {
        ids.push(await insertGym({ userId: me, date: "2026-03-01", startedAt: tieAt, createdAt: tieCreated }));
      }
      for (let i = 0; i < 23; i++) {
        const d = addDays("2026-02-27", -i);
        ids.push(await insertGym({ userId: me, date: d, startedAt: new Date(`${d}T06:00:00Z`) }));
      }
      expect(ids).toHaveLength(25);

      const page1 = await historyPage(me, null, 20);
      expect(page1.items).toHaveLength(20);
      expect(page1.nextCursor).not.toBeNull();

      const page2 = await historyPage(me, page1.nextCursor, 20);
      expect(page2.items).toHaveLength(5);
      expect(page2.nextCursor).toBeNull();

      const seen = [...page1.items, ...page2.items].map((i) => i.id);
      expect(new Set(seen).size).toBe(25);
      expect(new Set(seen)).toEqual(new Set(ids));

      const garbage = await historyPage(me, "not-a-valid-cursor!!", 20);
      expect(garbage.items.map((i) => i.id)).toEqual(page1.items.map((i) => i.id));
    });
  });

  describe("completeFitnessSetup", () => {
    it("saves height, goal weight and weekly goal, logs today's weight and sets fitnessOnboardedAt", async () => {
      const me = await createUser();
      const settings = await completeFitnessSetup(me, { heightCm: 172, weightKg: 72, goalWeightKg: 70, weeklyWorkoutGoal: 4 });
      expect(settings).toEqual({ weeklyWorkoutGoal: 4, goalWeightKg: 70, heightCm: 172 });

      const [w] = await db.select().from(bodyWeight).where(eq(bodyWeight.userId, me));
      expect(w).toMatchObject({ date: today(), kg: 72 });

      const [p] = await db.select().from(profile).where(eq(profile.userId, me));
      expect(p!.fitnessOnboardedAt).not.toBeNull();
    });

    it("skip sets only fitnessOnboardedAt", async () => {
      const me = await createUser();
      await completeFitnessSetup(me, { skip: true });
      const [p] = await db.select().from(profile).where(eq(profile.userId, me));
      expect(p!.fitnessOnboardedAt).not.toBeNull();
      expect(p!.heightCm).toBeNull();
      expect(p!.goalWeightKg).toBeNull();
      expect(p!.weeklyWorkoutGoal).toBe(3); // unchanged default

      const weights = await db.select().from(bodyWeight).where(eq(bodyWeight.userId, me));
      expect(weights).toHaveLength(0);
    });

    it("rejects a height out of range", async () => {
      const me = await createUser();
      await expect(completeFitnessSetup(me, { heightCm: 99, weeklyWorkoutGoal: 4 })).rejects.toThrow();
    });
  });

  describe("the backfill migration statement", () => {
    const BACKFILL = sql.raw(`
      UPDATE "profile" SET "fitness_onboarded_at" = now()
      WHERE "fitness_onboarded_at" IS NULL
        AND (EXISTS (SELECT 1 FROM "workout" w WHERE w."user_id" = "profile"."user_id")
             OR EXISTS (SELECT 1 FROM "body_weight" b WHERE b."user_id" = "profile"."user_id"));
    `);

    it("sets fitnessOnboardedAt for a profile with a workout, and leaves one with neither alone", async () => {
      const withWorkout = await createUser();
      await insertGym({ userId: withWorkout, date: today(), startedAt: new Date() });
      const withNeither = await createUser();

      await testDb().execute(BACKFILL);

      const [p1] = await db.select().from(profile).where(eq(profile.userId, withWorkout));
      expect(p1!.fitnessOnboardedAt).not.toBeNull();
      const [p2] = await db.select().from(profile).where(eq(profile.userId, withNeither));
      expect(p2!.fitnessOnboardedAt).toBeNull();
    });
  });
});
