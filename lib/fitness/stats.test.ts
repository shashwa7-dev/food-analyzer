import { describe, expect, it } from "vitest";
import { bestSet, e1rm, isPr, previousSets, upNext, volume, weekBounds, weekSummary, weightChange } from "./stats";
describe("stats", () => {
  it("volume counts only done sets with weight and reps", () => {
    expect(volume([{ weightKg: 60, reps: 8, done: true }, { weightKg: 60, reps: 8, done: false }, { weightKg: null, reps: 10, done: true }])).toBe(480);
  });
  it("e1rm is Epley", () => { expect(e1rm(100, 5)).toBeCloseTo(116.67, 1); expect(e1rm(60, 1)).toBeCloseTo(62, 0); });
  it("rotates Push → Pull → Legs, else Push", () => {
    expect(upNext("push")).toBe("pull"); expect(upNext("pull")).toBe("legs"); expect(upNext("legs")).toBe("push");
    expect(upNext("back")).toBe("push"); expect(upNext(null)).toBe("push");
  });
  it("weeks run Monday–Sunday", () => {
    expect(weekBounds("2026-10-08")).toEqual({ start: "2026-10-05", end: "2026-10-11" }); // Thursday
    expect(weekBounds("2026-10-05")).toEqual({ start: "2026-10-05", end: "2026-10-11" }); // Monday
    expect(weekBounds("2026-10-11")).toEqual({ start: "2026-10-05", end: "2026-10-11" }); // Sunday
  });
});

describe("weekBounds across months and years", () => {
  it("handles a week spanning a month and a year end", () => {
    expect(weekBounds("2026-11-01")).toEqual({ start: "2026-10-26", end: "2026-11-01" }); // Sunday
    expect(weekBounds("2027-01-01")).toEqual({ start: "2026-12-28", end: "2027-01-03" }); // Friday
  });
});

describe("bestSet and isPr", () => {
  it("picks the done set with the highest e1RM", () => {
    expect(bestSet([{ weightKg: 100, reps: 5, done: true }, { weightKg: 110, reps: 1, done: true }, { weightKg: 120, reps: 5, done: false }]))
      .toMatchObject({ weightKg: 100, reps: 5 });
    expect(bestSet([{ weightKg: null, reps: 10, done: true }, { weightKg: 0, reps: 10, done: true }])).toBeNull();
  });
  it("is a PR only when a done set beats the earlier best", () => {
    expect(isPr(116, { weightKg: 100, reps: 5, done: true })).toBe(true); // 116.67
    expect(isPr(116.67, { weightKg: 100, reps: 5, done: true })).toBe(false); // ties don't count
    expect(isPr(100, { weightKg: 100, reps: 5, done: false })).toBe(false);
    expect(isPr(100, { weightKg: null, reps: 5, done: true })).toBe(false);
    expect(isPr(null, { weightKg: 100, reps: 5, done: true })).toBe(false); // nothing earlier to beat
  });
});

describe("previousSets", () => {
  const sets = (kg: number) => [{ weightKg: kg, reps: 8, done: true }];
  const history = [
    { exercises: [{ exerciseKey: "squat", sets: sets(80) }] },
    { exercises: [{ exerciseKey: "bench_press", sets: sets(60) }, { exerciseKey: "squat", sets: sets(75) }] },
    { exercises: [{ exerciseKey: "bench_press", sets: sets(55) }] },
  ];
  it("returns the sets from the latest workout that contained the exercise", () => {
    expect(previousSets(history, "squat")).toEqual(sets(80));
    expect(previousSets(history, "bench_press")).toEqual(sets(60));
  });
  it("is null for an exercise never done", () => {
    expect(previousSets(history, "deadlift")).toBeNull();
    expect(previousSets([], "squat")).toBeNull();
  });
});

describe("weekSummary", () => {
  const w = (date: string, durationMin = 40, kcalBurned = 200, kcalEstimated = false) => ({ date, durationMin, kcalBurned, kcalEstimated });
  it("builds the strip, totals and goal for the week only", () => {
    const s = weekSummary([w("2026-10-04"), w("2026-10-05"), w("2026-10-05", 20, 100), w("2026-10-07", 30, 150, true), w("2026-10-12")], "2026-10-05", "2026-10-08", 3);
    expect(s.start).toBe("2026-10-05");
    expect(s.end).toBe("2026-10-11");
    expect(s.days.map((d) => d.state)).toEqual(["done", "rest", "done", "today", "future", "future", "future"]);
    expect(s.days.map((d) => d.label).join("")).toBe("MTWTFSS");
    expect(s.days[0]).toMatchObject({ sessions: 2, trained: true, isToday: false });
    expect(s.days[3]).toMatchObject({ isToday: true, trained: false });
    expect(s).toMatchObject({ sessions: 3, minutes: 90, kcal: 450, kcalEstimated: true, goal: { target: 3, done: 2, met: false } });
  });
  it("marks today done when trained, and the goal met at the target", () => {
    const s = weekSummary([w("2026-10-05"), w("2026-10-06"), w("2026-10-08")], "2026-10-05", "2026-10-08", 3);
    expect(s.days[3]).toMatchObject({ state: "done", isToday: true });
    expect(s.goal).toEqual({ target: 3, done: 3, met: true });
    expect(s.kcalEstimated).toBe(false);
  });
});

describe("weightChange", () => {
  it("is the latest minus the earliest entry in the 30 days ending at the latest", () => {
    expect(weightChange([{ date: "2026-10-08", kg: 72.4 }, { date: "2026-08-01", kg: 80 }, { date: "2026-09-10", kg: 73.5 }, { date: "2026-09-20", kg: 73 }])).toBe(-1.1);
  });
  it("is null without two entries in the window", () => {
    expect(weightChange([{ date: "2026-10-08", kg: 72 }])).toBeNull();
    expect(weightChange([{ date: "2026-10-08", kg: 72 }, { date: "2026-08-01", kg: 80 }])).toBeNull();
  });
});
