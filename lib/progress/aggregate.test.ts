import { describe, expect, it } from "vitest";
import { onTargetRange, streakEnding, summarize, type DayAgg } from "./aggregate";
import { targetsFor } from "@/lib/nutrition/targets";

const T = targetsFor("general"); // energyKcal 2000, protein 60, fibre 30, sugarsMax 50, sodiumMgMax 2000, satFatMax 22
const day = (date: string, kcal: number, extra: Partial<DayAgg> = {}): DayAgg => ({
  date, kcal, protein: 60, carbs: 250, fat: 60, fibre: 30, sugars: 40, sodiumMg: 1800, satFat: 18, entries: 3, gradeKcal: {}, ...extra,
});

describe("onTargetRange", () => {
  it("is 80–100% for weight loss and 90–110% otherwise", () => {
    expect(onTargetRange("weight_loss")).toEqual([0.8, 1.0]);
    expect(onTargetRange("general")).toEqual([0.9, 1.1]);
    expect(onTargetRange("muscle")).toEqual([0.9, 1.1]);
  });
});

describe("streakEnding", () => {
  it("counts back from today", () => {
    expect(streakEnding(new Set(["2026-10-05", "2026-10-06", "2026-10-07"]), "2026-10-07")).toBe(3);
  });
  it("counts back from yesterday when today is empty", () => {
    expect(streakEnding(new Set(["2026-10-05", "2026-10-06"]), "2026-10-07")).toBe(2);
  });
  it("is 0 when neither today nor yesterday has entries", () => {
    expect(streakEnding(new Set(["2026-10-04"]), "2026-10-07")).toBe(0);
  });
  it("crosses a month boundary", () => {
    expect(streakEnding(new Set(["2026-09-30", "2026-10-01"]), "2026-10-01")).toBe(2);
  });
});

describe("summarize", () => {
  it("returns zeros, not NaN, for no data", () => {
    const s = summarize([], T, "general", "2026-10-07", "week");
    expect(s.kpis).toEqual({ avgKcal: 0, avgProtein: 0, daysOnTarget: 0, daysLogged: 0, streak: 0 });
    expect(s.macroSplit).toEqual({ protein: 0, carbs: 0, fat: 0 });
    expect(Object.values(s.balance).every((v) => v === 0)).toBe(true);
    expect(s.gradeMix).toEqual({ A: 0, B: 0, C: 0, D: 0, E: 0 });
    expect(s.worstOverLimit).toBeNull();
    expect(s.days).toHaveLength(7);
  });
  it("fills missing days with zero rows across the range, oldest first", () => {
    const s = summarize([day("2026-10-07", 1800)], T, "general", "2026-10-07", "week");
    expect(s.days.map((d) => d.date)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07"]);
    expect(s.days[0].entries).toBe(0);
    expect(summarize([], T, "general", "2026-10-07", "month").days).toHaveLength(30);
  });
  it("averages only over logged days and counts on-target days", () => {
    const s = summarize([day("2026-10-06", 1900), day("2026-10-07", 2500)], T, "general", "2026-10-07", "week");
    expect(s.kpis.avgKcal).toBe(2200);
    expect(s.kpis.daysLogged).toBe(2);
    expect(s.kpis.daysOnTarget).toBe(1); // 1900 is in range; 2500 is 125%
  });
  it("computes the macro split as % of kcal from macros, summing to 100", () => {
    const s = summarize([day("2026-10-07", 2000, { protein: 100, carbs: 200, fat: 50 })], T, "general", "2026-10-07", "week");
    // 400 + 800 + 450 = 1650 kcal → 24.24 / 48.48 / 27.27 → largest remainder (carbs) gets the spare point
    expect(s.macroSplit).toEqual({ protein: 24, carbs: 49, fat: 27 });
  });
  it("caps balance at 150 and names the worst limit over 100", () => {
    const s = summarize([day("2026-10-07", 2000, { sodiumMg: 5000, sugars: 60, satFat: 10 })], T, "general", "2026-10-07", "week");
    expect(s.balance.sodium).toBe(150);
    expect(s.balance.sugars).toBe(120);
    expect(s.worstOverLimit).toEqual({ axis: "sodium", pct: 250 });
  });
  it("builds the grade mix from graded kcal only", () => {
    const s = summarize([day("2026-10-07", 2000, { gradeKcal: { A: 600, B: 300, E: 100 } })], T, "general", "2026-10-07", "week");
    expect(s.gradeMix).toEqual({ A: 60, B: 30, C: 0, D: 0, E: 10 });
  });
});

describe("summarize edge cases", () => {
  it("uses the 80–100% band for weight loss, inclusive at both ends", () => {
    const WL = targetsFor("weight_loss"); // 1700 kcal
    const s = summarize([day("2026-10-05", 1360), day("2026-10-06", 1700), day("2026-10-07", 1750)], WL, "weight_loss", "2026-10-07", "week");
    expect(s.kpis.daysOnTarget).toBe(2);
  });
  it("ignores zero-entry rows when averaging", () => {
    const s = summarize([day("2026-10-06", 0, { entries: 0, protein: 0 }), day("2026-10-07", 1800)], T, "general", "2026-10-07", "week");
    expect(s.kpis.daysLogged).toBe(1);
    expect(s.kpis.avgKcal).toBe(1800);
  });
  it("lets the streak reach back past the range when given streak dates", () => {
    const dates = Array.from({ length: 12 }, (_, i) => `2026-10-${String(7 - i).padStart(2, "0")}`).filter((d) => d >= "2026-10-01")
      .concat(["2026-09-30", "2026-09-29", "2026-09-28", "2026-09-27", "2026-09-26"]);
    const s = summarize([day("2026-10-07", 1800)], T, "general", "2026-10-07", "week", dates);
    expect(s.kpis.streak).toBe(12);
  });
  it("has no worst limit when every limit is within, and picks the largest when several are over", () => {
    expect(summarize([day("2026-10-07", 2000)], T, "general", "2026-10-07", "week").worstOverLimit).toBeNull();
    const s = summarize([day("2026-10-07", 2000, { sugars: 75, sodiumMg: 2200, satFat: 33 })], T, "general", "2026-10-07", "month");
    expect(s.worstOverLimit).toEqual({ axis: "sugars", pct: 150 });
  });
  it("leaves the grade mix at zero when nothing logged was graded", () => {
    const s = summarize([day("2026-10-07", 2000)], T, "general", "2026-10-07", "week");
    expect(s.gradeMix).toEqual({ A: 0, B: 0, C: 0, D: 0, E: 0 });
  });
});
