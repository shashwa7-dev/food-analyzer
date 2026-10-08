import { beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { createUser, resetDb } from "@/tests/helpers/db";
import { db } from "@/lib/db/client";
import { bodyWeight, profile, workout } from "@/lib/db/schema";
import { addDays, todayIn } from "@/lib/dates";
import { InvalidError } from "@/lib/errors";
import {
  createWorkout, deleteWorkout, getFitnessSummary, getWorkout, listWorkouts, previousSetsFor, updateFitnessSettings, updateWorkout,
} from "./service";

const today = () => todayIn("Asia/Kolkata");
const set = (weightKg: number | null, reps: number | null, done = true) => ({ weightKg, reps, done });

/** A gym session through the service, `daysAgo` before today (IST). */
function gym(userId: string, daysAgo: number, exercises: { exerciseKey?: string; name?: string; sets: ReturnType<typeof set>[] }[], extra: Record<string, unknown> = {}) {
  const date = addDays(today(), -daysAgo);
  return createWorkout(userId, { kind: "gym", date, preset: "push", durationMin: 48, startedAt: `${date}T06:00:00+05:30`, exercises, ...extra });
}

/** A workout row straight into the table, for fixed-date summary tests (the service only takes dates near today). */
async function seed(userId: string, date: string, over: Partial<typeof workout.$inferInsert> = {}) {
  await db.insert(workout).values({
    userId, date, kind: "gym", preset: "push", title: "Push", intensity: "moderate", startedAt: new Date(`${date}T07:00:00+05:30`),
    durationMin: 45, kcalBurned: 263, kcalBasis: { met: 5, weightKg: 70, estimated: true, minutes: 45 }, ...over,
  });
}

describe("workouts", () => {
  let me = "";
  let other = "";
  beforeEach(async () => {
    await resetDb();
    me = await createUser();
    other = await createUser();
  });

  it("creates a gym session with exercises and sets, kcal computed on the server (70 kg estimate with no weight)", async () => {
    const w = await gym(me, 0, [
      { exerciseKey: "bench_press", sets: [set(60, 8), set(60, 8), set(62.5, 6, false)] },
      { name: "Cable kickback", sets: [set(10, 12)] },
    ]);
    expect(w).toMatchObject({
      kind: "gym", preset: "push", title: "Push day", intensity: "moderate", durationMin: 48, kcalBurned: 280, kcalEstimated: true,
      kcalBasis: { met: 5, weightKg: 70, estimated: true, minutes: 48 }, exerciseCount: 2, setCount: 3, volumeKg: 1080, prCount: 0,
    });
    expect(w.exercises.map((e) => [e.exerciseKey, e.name, e.sets.length])).toEqual([["bench_press", "Bench press", 3], ["custom:cable_kickback", "Cable kickback", 1]]);
    expect(w.exercises[0]!.sets[2]).toEqual({ position: 2, weightKg: 62.5, reps: 6, done: false });
    expect(w.exercises[0]!.best).toMatchObject({ weightKg: 60, reps: 8 });
    expect(w.startedAt).toBe(new Date(`${w.date}T06:00:00+05:30`).toISOString());
  });

  it("uses the latest weight on or before the workout's date, never a later one", async () => {
    const date = addDays(today(), -3);
    await db.insert(bodyWeight).values([
      { userId: me, date: addDays(date, -10), kg: 80 },
      { userId: me, date: addDays(date, -2), kg: 72 },
      { userId: me, date: addDays(date, 1), kg: 90 },
      { userId: other, date, kg: 50 },
    ]);
    const w = await createWorkout(me, { kind: "activity", date, activity: "walk", intensity: "moderate", durationMin: 35 });
    expect(w).toMatchObject({ kind: "activity", activity: "walk", title: "Walk", kcalBurned: 147, kcalEstimated: false, kcalBasis: { met: 3.5, weightKg: 72, estimated: false }, exercises: [] });
  });

  it("refuses bad input: an unknown exercise with no name, an activity with no minutes, a date beyond tomorrow", async () => {
    await expect(gym(me, 0, [{ exerciseKey: "nope", sets: [] }])).rejects.toThrow();
    await expect(createWorkout(me, { kind: "activity", date: today(), activity: "run", intensity: "easy", durationMin: 0 })).rejects.toThrow();
    await expect(createWorkout(me, { kind: "activity", date: addDays(today(), 5), activity: "run", intensity: "easy", durationMin: 20 })).rejects.toThrow();
  });

  it("lists the user's workouts newest first within from–to, and nobody else's", async () => {
    await gym(me, 5, []);
    await gym(me, 1, [], { preset: "legs" });
    await gym(me, 40, []);
    await gym(other, 1, []);
    const all = await listWorkouts(me, {});
    expect(all.map((w) => w.date)).toEqual([addDays(today(), -1), addDays(today(), -5)]);
    expect(all[0]!.title).toBe("Leg day");
    expect((await listWorkouts(me, { from: addDays(today(), -60), to: addDays(today(), -2) })).map((w) => w.date)).toEqual([addDays(today(), -5), addDays(today(), -40)]);
    await expect(listWorkouts(me, { from: "2026-10-05", to: "2026-10-01" })).rejects.toBeInstanceOf(InvalidError);
    await expect(listWorkouts(me, { from: "2024-01-01", to: "2026-01-01" })).rejects.toBeInstanceOf(InvalidError);
  });

  it("scopes get, patch and delete to the owner", async () => {
    const w = await gym(me, 0, [{ exerciseKey: "squat", sets: [set(100, 5)] }]);
    expect(await getWorkout(other, w.id)).toBeNull();
    expect(await updateWorkout(other, w.id, { title: "Mine now" })).toBeNull();
    expect(await deleteWorkout(other, w.id)).toBe(false);
    expect((await getWorkout(me, w.id))!.title).toBe("Push day");
    expect(await getWorkout(me, "not-a-uuid")).toBeNull();
  });

  it("patch edits the fields and the full exercise list, and recomputes kcal from the current weight", async () => {
    const w = await gym(me, 2, [{ exerciseKey: "bench_press", sets: [set(60, 8)] }]);
    expect(w.kcalEstimated).toBe(true);
    await db.insert(bodyWeight).values({ userId: me, date: addDays(today(), -3), kg: 80 });
    const p = await updateWorkout(me, w.id, {
      title: "Heavy push", durationMin: 60, intensity: "hard", notes: "Felt strong",
      exercises: [{ exerciseKey: "overhead_press", sets: [set(40, 5), set(40, 5)] }, { exerciseKey: "dip", sets: [set(null, 12)] }],
    });
    expect(p).toMatchObject({
      title: "Heavy push", durationMin: 60, intensity: "hard", notes: "Felt strong", kcalBurned: 480, kcalEstimated: false,
      kcalBasis: { met: 6, weightKg: 80, estimated: false, minutes: 60 }, exerciseCount: 2, setCount: 3, volumeKg: 400,
    });
    expect(p!.exercises.map((e) => e.exerciseKey)).toEqual(["overhead_press", "dip"]);
    expect(p!.updatedAt > w.updatedAt).toBe(true);
    // Only the given fields change; notes can be cleared.
    const q = await updateWorkout(me, w.id, { notes: null });
    expect(q).toMatchObject({ title: "Heavy push", notes: null, exerciseCount: 2 });
  });

  it("refuses exercises on an activity", async () => {
    const a = await createWorkout(me, { kind: "activity", date: today(), activity: "yoga", intensity: "easy", durationMin: 30 });
    await expect(updateWorkout(me, a.id, { exercises: [] })).rejects.toBeInstanceOf(InvalidError);
    expect((await updateWorkout(me, a.id, { intensity: "hard" }))!.kcalBurned).toBe(140); // 4.0 × 70 × 0.5
  });

  it("soft-deletes: the row stays, but get, list, patch and PRs no longer see it", async () => {
    const w = await gym(me, 1, [{ exerciseKey: "squat", sets: [set(100, 5)] }]);
    expect(await deleteWorkout(me, w.id)).toBe(true);
    expect(await deleteWorkout(me, w.id)).toBe(false);
    expect(await getWorkout(me, w.id)).toBeNull();
    expect(await updateWorkout(me, w.id, { title: "x" })).toBeNull();
    expect(await listWorkouts(me, {})).toEqual([]);
    const [row] = await db.select({ deletedAt: workout.deletedAt }).from(workout).where(eq(workout.id, w.id));
    expect(row!.deletedAt).toBeInstanceOf(Date);
    expect(await previousSetsFor(me, ["squat"])).toEqual({});
  });

  it("flags a PR when an exercise's best set beats every earlier best for that key", async () => {
    const first = await gym(me, 3, [{ exerciseKey: "bench_press", sets: [set(100, 5)] }]);
    const second = await gym(me, 2, [{ exerciseKey: "bench_press", sets: [set(105, 5)] }, { exerciseKey: "squat", sets: [set(120, 5)] }]);
    const third = await gym(me, 1, [{ exerciseKey: "bench_press", sets: [set(100, 5), set(110, 5, false)] }]);
    expect((await getWorkout(me, first.id))!.exercises[0]!.pr).toBe(false); // nothing earlier to beat
    const s = (await getWorkout(me, second.id))!;
    expect(s.exercises.map((e) => e.pr)).toEqual([true, false]);
    expect(s.prCount).toBe(1);
    expect((await getWorkout(me, third.id))!.exercises[0]!.pr).toBe(false); // the undone 110 doesn't count
    // Another user's heavier lifts never count, and a deleted earlier session drops out.
    await gym(other, 4, [{ exerciseKey: "bench_press", sets: [set(200, 5)] }]);
    expect((await getWorkout(me, second.id))!.exercises[0]!.pr).toBe(true);
    await deleteWorkout(me, first.id);
    expect((await getWorkout(me, second.id))!.exercises[0]!.pr).toBe(false);
  });

  it("previous sets come from the latest workout that had each exercise", async () => {
    await gym(me, 3, [{ exerciseKey: "squat", sets: [set(90, 5)] }, { exerciseKey: "bench_press", sets: [set(55, 8)] }]);
    await gym(me, 1, [{ exerciseKey: "squat", sets: [set(100, 5), set(100, 4)] }]);
    await gym(other, 0, [{ exerciseKey: "squat", sets: [set(150, 5)] }]);
    expect(await previousSetsFor(me, ["squat", "bench_press", "deadlift"])).toEqual({
      squat: [{ position: 0, weightKg: 100, reps: 5, done: true }, { position: 1, weightKg: 100, reps: 4, done: true }],
      bench_press: [{ position: 0, weightKg: 55, reps: 8, done: true }],
    });
  });
});

describe("fitness summary", () => {
  let me = "";
  beforeEach(async () => {
    await resetDb();
    me = await createUser();
  });

  it("returns the week strip, goal progress, minutes, kcal, up next and the recent five for a seeded week", async () => {
    await db.update(profile).set({ weeklyWorkoutGoal: 4 }).where(eq(profile.userId, me));
    await seed(me, "2026-10-04", { preset: "back", title: "Back" }); // the Sunday before: not this week
    await seed(me, "2026-10-05", { preset: "push" }); // Monday
    await seed(me, "2026-10-06", { kind: "activity", preset: null, activity: "walk", title: "Walk", durationMin: 30, kcalBurned: 123, kcalBasis: { met: 3.5, weightKg: 70, estimated: false, minutes: 30 } });
    await seed(me, "2026-10-06", { preset: "pull", title: "Pull", startedAt: new Date("2026-10-06T18:00:00+05:30") }); // Tuesday, twice
    await seed(me, "2026-10-07", { preset: "legs", title: "Legs" }); // Wednesday
    await seed(me, "2026-10-12", { preset: "push" }); // next week
    await db.execute(sql`UPDATE workout SET deleted_at = now() WHERE date = '2026-10-12'`);
    const now = new Date("2026-10-08T06:00:00Z"); // Thursday 11:30 IST
    const s = await getFitnessSummary(me, {}, now);
    expect(s.today).toBe("2026-10-08");
    expect(s.week).toMatchObject({ start: "2026-10-05", end: "2026-10-11", sessions: 4, minutes: 165, kcal: 263 * 3 + 123, kcalEstimated: true, goal: { target: 4, done: 3, met: false } });
    expect(s.week.days.map((d) => d.state)).toEqual(["done", "done", "done", "today", "future", "future", "future"]);
    expect(s.week.days[1]!.sessions).toBe(2);
    expect(s.upNext).toEqual({ preset: "push", title: "Push day", muscles: "Chest · Shoulders · Triceps", exerciseCount: 5 }); // after Legs
    expect(s.recent.map((w) => w.title)).toEqual(["Legs", "Pull", "Walk", "Push", "Back"]);
    // Another week by any date inside it.
    const last = await getFitnessSummary(me, { week: "2026-09-30" }, now);
    expect(last.week).toMatchObject({ start: "2026-09-28", end: "2026-10-04", sessions: 1 });
    expect(last.week.days.map((d) => d.state)).toEqual(["rest", "rest", "rest", "rest", "rest", "rest", "done"]);
  });

  it("up next follows the latest gym preset, skipping activities and empty sessions; Push with no history", async () => {
    expect((await getFitnessSummary(me, {}, new Date("2026-10-08T06:00:00Z"))).upNext.preset).toBe("push");
    await seed(me, "2026-10-05", { preset: "push" });
    await seed(me, "2026-10-06", { preset: null, title: "Workout" });
    await seed(me, "2026-10-07", { kind: "activity", preset: null, activity: "run", title: "Run" });
    expect((await getFitnessSummary(me, {}, new Date("2026-10-08T06:00:00Z"))).upNext.preset).toBe("pull");
  });

  it("an IST user at 00:30 on a Monday is in the new week", async () => {
    await seed(me, "2026-10-11", { preset: "pull" }); // Sunday
    const now = new Date("2026-10-11T19:00:00Z"); // Monday 12 Oct, 00:30 IST (still Sunday in UTC)
    const s = await getFitnessSummary(me, {}, now);
    expect(s.today).toBe("2026-10-12");
    expect(s.week).toMatchObject({ start: "2026-10-12", end: "2026-10-18", sessions: 0, minutes: 0, kcal: 0, goal: { target: 3, done: 0, met: false } });
    expect(s.week.days[0]).toMatchObject({ date: "2026-10-12", state: "today", isToday: true });
    expect(s.upNext.preset).toBe("legs");
    // The same instant for a UTC user is still Sunday, in the old week.
    await db.update(profile).set({ timezone: "UTC" }).where(eq(profile.userId, me));
    expect((await getFitnessSummary(me, {}, now)).week).toMatchObject({ start: "2026-10-05", sessions: 1 });
  });
});

describe("fitness settings", () => {
  beforeEach(resetDb);
  it("sets the weekly goal and goal weight, with range checks and null clearing", async () => {
    const me = await createUser();
    expect(await updateFitnessSettings(me, {})).toEqual({ weeklyWorkoutGoal: 3, goalWeightKg: null, heightCm: null });
    expect(await updateFitnessSettings(me, { weeklyWorkoutGoal: 5, goalWeightKg: 68.456 })).toEqual({ weeklyWorkoutGoal: 5, goalWeightKg: 68.46, heightCm: null });
    expect(await updateFitnessSettings(me, { goalWeightKg: null })).toEqual({ weeklyWorkoutGoal: 5, goalWeightKg: null, heightCm: null });
    await expect(updateFitnessSettings(me, { weeklyWorkoutGoal: 8 })).rejects.toThrow();
    await expect(updateFitnessSettings(me, { weeklyWorkoutGoal: 0 })).rejects.toThrow();
    // The database guards the range too.
    await expect(db.update(profile).set({ weeklyWorkoutGoal: 9 }).where(eq(profile.userId, me))).rejects.toThrow();
  });
});
