import { describe, expect, it } from "vitest";
import {
  buildStats, byType, dayType, goalStreak, monthCalendar, niceBounds, periodBounds, periodTiles, prEvents, topExercises,
  volumeWeeks, type InsightSet, type InsightWorkout,
} from "./insights";

let n = 0;
const w = (date: string, p: Partial<InsightWorkout> = {}): InsightWorkout => ({
  id: `w${++n}`, date, kind: "gym", preset: "push", startedAt: `${date}T12:00:00.000Z`, durationMin: 45, kcalBurned: 300,
  kcalEstimated: false, volumeKg: 1000, ...p,
});
const s = (wk: InsightWorkout, exerciseKey: string, weightKg: number | null, reps: number | null, name = exerciseKey): InsightSet => ({
  workoutId: wk.id, date: wk.date, startedAt: wk.startedAt, createdAt: wk.startedAt, exerciseKey, name, weightKg, reps,
});

describe("periodBounds", () => {
  it("week: Monday to today, against the same span last week", () => {
    expect(periodBounds("week", "2026-10-08")).toEqual({ start: "2026-10-05", end: "2026-10-08", prevStart: "2026-09-28", prevEnd: "2026-10-01" });
  });
  it("month: 1st to today, against the previous month's same days", () => {
    expect(periodBounds("month", "2026-10-08")).toEqual({ start: "2026-10-01", end: "2026-10-08", prevStart: "2026-09-01", prevEnd: "2026-09-08" });
  });
  it("month: clamps to a shorter previous month and wraps the year", () => {
    expect(periodBounds("month", "2026-03-31").prevEnd).toBe("2026-02-28");
    expect(periodBounds("month", "2028-03-31").prevEnd).toBe("2028-02-29");
    expect(periodBounds("month", "2027-01-15")).toMatchObject({ prevStart: "2026-12-01", prevEnd: "2026-12-15" });
  });
});

describe("dayType", () => {
  it("is the first gym session's preset, custom for an empty session, activity when only activities", () => {
    expect(dayType([])).toBeNull();
    expect(dayType([w("2026-10-01", { kind: "activity", preset: null, startedAt: "2026-10-01T06:00:00.000Z" }), w("2026-10-01", { preset: "legs" })])).toBe("legs");
    expect(dayType([w("2026-10-01", { preset: "pull", startedAt: "2026-10-01T18:00:00.000Z" }), w("2026-10-01", { preset: "push", startedAt: "2026-10-01T07:00:00.000Z" })])).toBe("push");
    expect(dayType([w("2026-10-01", { preset: null })])).toBe("custom");
    expect(dayType([w("2026-10-01", { kind: "activity", preset: null })])).toBe("activity");
  });
});

describe("monthCalendar", () => {
  it("lays out the month Monday-first with types, today and future", () => {
    const cal = monthCalendar([w("2026-10-02", { preset: "pull" }), w("2026-10-02", { kind: "activity", preset: null }), w("2026-09-30")], "2026-10-08");
    expect(cal.month).toBe("2026-10");
    expect(cal.leadingBlanks).toBe(3); // 1 Oct 2026 is a Thursday
    expect(cal.days).toHaveLength(31);
    expect(cal.days[1]).toEqual({ date: "2026-10-02", type: "pull", isToday: false, isFuture: false });
    expect(cal.days[7]).toMatchObject({ isToday: true, type: null });
    expect(cal.days[8]!.isFuture).toBe(true);
    expect(cal.workoutDays).toBe(1);
  });
});

describe("niceBounds", () => {
  it("fits the axis to the data with round ticks", () => {
    expect(niceBounds([8100, 9600, 7400, 9900, 11000, 10600, 10600, 12400])).toEqual({ min: 5000, max: 15000, ticks: [5000, 10000, 15000] });
  });
  it("never goes below zero and handles flat or empty data", () => {
    expect(niceBounds([0, 0, 0])).toEqual({ min: 0, max: 1000, ticks: [0, 500, 1000] });
    expect(niceBounds([])).toEqual({ min: 0, max: 1000, ticks: [0, 500, 1000] });
  });
});

describe("volumeWeeks", () => {
  it("buckets 8 Monday weeks, oldest first, with the summary numbers", () => {
    const ws = [w("2026-10-06", { volumeKg: 3000 }), w("2026-10-08", { volumeKg: 2000 }), w("2026-09-29", { volumeKg: 4000 }), w("2026-08-17", { volumeKg: 2500 }), w("2026-08-10", { volumeKg: 999 })];
    const v = volumeWeeks(ws, "2026-10-08");
    expect(v.weeks.map((x) => x.start)).toEqual(["2026-08-17", "2026-08-24", "2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05"]);
    expect(v.weeks.map((x) => x.kg)).toEqual([2500, 0, 0, 0, 0, 0, 4000, 5000]);
    expect(v).toMatchObject({ current: 5000, deltaVsLast: 1000, best: 5000, avg: 1437.5, trendPct: 60 });
  });
  it("compares this week so far with last week up to the same weekday only", () => {
    const ws = [w("2026-10-06", { volumeKg: 3000 }), w("2026-09-29", { volumeKg: 1000 }), w("2026-10-02", { volumeKg: 7000 })];
    expect(volumeWeeks(ws, "2026-10-08").deltaVsLast).toBe(2000); // the Friday 2 Oct workout is after last Thursday
  });
  it("on a Monday with nothing logged yet is not -100%", () => {
    const v = volumeWeeks([w("2026-09-30", { volumeKg: 4000 })], "2026-10-05");
    expect(v.current).toBe(0);
    expect(v.deltaVsLast).toBe(0); // last Monday had nothing; Wednesday's workout is later in the week
  });
  it("has no trend when the first week is empty", () => {
    expect(volumeWeeks([w("2026-10-06")], "2026-10-08").trendPct).toBeNull();
  });
});

describe("prEvents", () => {
  it("flags a workout that beats every earlier one; not the first time, not a tie", () => {
    const a = w("2026-09-01"), b = w("2026-09-08"), c = w("2026-09-15"), d = w("2026-09-22");
    const sets = [s(a, "bench_press", 60, 8), s(b, "bench_press", 60, 8), s(c, "bench_press", 62.5, 8), s(c, "bench_press", 50, 5), s(d, "bench_press", 40, 20), s(a, "squat", 80, 5)];
    expect(prEvents(sets)).toEqual([{ workoutId: c.id, date: "2026-09-15", exerciseKey: "bench_press" }]);
  });
  it("ignores sets without a positive weight and reps", () => {
    const a = w("2026-09-01"), b = w("2026-09-08");
    expect(prEvents([s(a, "push_up", null, 20), s(b, "push_up", null, 30)])).toEqual([]);
  });
});

describe("topExercises", () => {
  const p = periodBounds("month", "2026-10-08");
  it("ranks by sets, then volume, then name, with best, e1RM change and an 8-week sparkline", () => {
    const sep = w("2026-09-03"), o1 = w("2026-10-02"), o2 = w("2026-10-06");
    const sets = [
      s(sep, "bench_press", 60, 8, "Bench press"),
      s(o1, "bench_press", 62.5, 8, "Bench press"), s(o1, "bench_press", 62.5, 6, "Bench press"), s(o2, "bench_press", 65, 5, "Bench press"),
      s(o1, "squat", 80, 5, "Back squat"), s(o2, "squat", 80, 5, "Back squat"),
      s(o1, "curl", 10, 12, "Curl"), s(o2, "curl", 10, 12, "Curl"),
      s(o2, "row", 40, 10, "Row"),
    ];
    const top = topExercises(sets, p, "2026-10-08");
    expect(top.map((t) => t.exerciseKey)).toEqual(["bench_press", "squat", "curl"]);
    expect(top[0]).toMatchObject({ name: "Bench press", sets: 3, sessions: 2, best: { weightKg: 62.5, reps: 8 }, e1rm: 79.2 });
    expect(top[0]!.e1rmDelta).toBe(3.2); // 62.5×(1+8/30)=79.17 vs 60×(1+8/30)=76
    expect(top[0]!.spark).toHaveLength(8);
    expect(top[0]!.spark.at(-1)).toBe(75.8); // this week (from 5 Oct) has only 65 × 5: 65 × (1 + 5/30) = 75.83
  });
  it("keeps exercises with no weighted set, with null best", () => {
    const o = w("2026-10-02");
    const top = topExercises([s(o, "plank", null, 3, "Plank")], p, "2026-10-08");
    expect(top).toEqual([{ exerciseKey: "plank", name: "Plank", sets: 1, sessions: 1, best: null, e1rm: null, e1rmDelta: null, spark: [null, null, null, null, null, null, null, null] }]);
  });
});

describe("byType", () => {
  it("counts sessions per type in the fixed order, skipping zeros", () => {
    const ws = [w("2026-10-01", { preset: "legs" }), w("2026-10-02", { preset: "push" }), w("2026-10-03", { preset: "push" }), w("2026-10-03", { kind: "activity", preset: null }), w("2026-09-01")];
    expect(byType(ws, "2026-10-01", "2026-10-08")).toEqual([{ type: "push", sessions: 2 }, { type: "legs", sessions: 1 }, { type: "activity", sessions: 1 }]);
  });
});

describe("periodTiles", () => {
  it("totals the period and compares with the previous one", () => {
    const p = periodBounds("week", "2026-10-08");
    const ws = [
      w("2026-10-05", { durationMin: 50, kcalBurned: 320, volumeKg: 4000 }), w("2026-10-05", { kind: "activity", preset: null, durationMin: 30, kcalBurned: 100, volumeKg: 0, kcalEstimated: true }),
      w("2026-10-07", { durationMin: 40, kcalBurned: 280, volumeKg: 3000 }),
      w("2026-09-29", { durationMin: 45, kcalBurned: 300, volumeKg: 3500 }),
    ];
    const t = periodTiles(ws, [{ workoutId: ws[2]!.id, date: "2026-10-07", exerciseKey: "bench_press" }], p);
    expect(t).toEqual({
      workoutDays: { value: 2, prev: 1, delta: 1 }, minutes: { value: 120, prev: 45, delta: 75 }, kcal: { value: 700, prev: 300, delta: 400 },
      kcalEstimated: true, volumeKg: { value: 7000, prev: 3500, delta: 3500 }, prs: { value: 1, prev: 0, delta: 1 },
    });
  });
});

describe("goalStreak", () => {
  const days = (...ds: string[]) => ds.map((d) => w(d));
  it("counts back from this week when it's met, else from last week", () => {
    const ws = days("2026-10-05", "2026-10-06", "2026-09-29", "2026-09-30", "2026-09-22", "2026-09-23", "2026-09-08", "2026-09-09");
    expect(goalStreak(ws, "2026-10-08", 2)).toBe(3);
    expect(goalStreak(ws.slice(2), "2026-10-08", 2)).toBe(2); // this week not met yet: last week + the one before
    expect(goalStreak([], "2026-10-08", 2)).toBe(0);
  });
});

describe("buildStats", () => {
  const ws = [w("2026-10-06")];
  it("fills the Pro fields when unlocked and nulls them when locked", () => {
    const open = buildStats({ range: "week", today: "2026-10-08", goal: 3, workouts: ws, sets: [], locked: false });
    expect(open.hasWorkouts).toBe(true);
    expect(open.calendar).not.toBeNull();
    expect(open.volume).not.toBeNull();
    expect(open.topExercises).toEqual([]);
    expect(open.byType).toEqual([{ type: "push", sessions: 1 }]);
    const locked = buildStats({ range: "week", today: "2026-10-08", goal: 3, workouts: ws, sets: [], locked: true });
    expect(locked).toMatchObject({ locked: true, calendar: null, volume: null, topExercises: null, byType: null });
    expect(locked.tiles.workoutDays.value).toBe(1);
  });
  it("has no workouts for a new user", () => {
    expect(buildStats({ range: "week", today: "2026-10-08", goal: 3, workouts: [], sets: [], locked: false }).hasWorkouts).toBe(false);
  });
});
