import { describe, expect, it } from "vitest";
import { summarize, type DayAgg } from "./aggregate";
import { targetsFor } from "@/lib/nutrition/targets";
import { balanceRows, calorieBars, labelledDates, niceAxis, sodiumPoints } from "./chart-data";

const d = (date: string, kcal: number, sodiumMg: number, entries = 2): DayAgg => ({
  date, kcal, protein: 0, carbs: 0, fat: 0, fibre: 0, sugars: 0, sodiumMg, satFat: 0, entries, gradeKcal: {},
});

describe("calorieBars", () => {
  it("hatches above the goal's on-target band (weight loss: 100%), never an empty day, and flags today", () => {
    const bars = calorieBars([d("2026-10-05", 2000, 0), d("2026-10-06", 2001, 0), d("2026-10-07", 0, 0, 0)], 2000, "2026-10-07", "weight_loss");
    expect(bars.map((b) => b.over)).toEqual([false, true, false]);
    expect(bars.map((b) => b.isToday)).toEqual([false, false, true]);
    expect(bars[2]!.logged).toBe(false);
  });
});

describe("calorieBars and the on-target KPI agree", () => {
  it("uses 110% for general goals: 105% is on target and not hatched, 115% is hatched", () => {
    const bars = calorieBars([d("2026-10-06", 2100, 0), d("2026-10-07", 2300, 0)], 2000, "2026-10-07", "general");
    expect(bars.map((b) => b.over)).toEqual([false, true]);
  });
  it.each(["general", "weight_loss", "muscle"] as const)("never hatches a day the KPI counts as on target (%s)", (goal) => {
    const T = targetsFor(goal);
    for (const ratio of [0.75, 0.8, 0.85, 0.9, 0.95, 1.0, 1.0001, 1.05, 1.1, 1.1001, 1.3]) {
      const day = d("2026-10-07", T.energyKcal * ratio, 0);
      const hatched = calorieBars([day], T.energyKcal, "2026-10-07", goal)[0]!.over;
      const onTarget = summarize([day], T, goal, "2026-10-07", "week").kpis.daysOnTarget === 1;
      expect(hatched && onTarget, `${goal} at ${ratio}`).toBe(false);
      if (ratio > 1.2) expect(hatched).toBe(true);
    }
  });
});

describe("sodiumPoints", () => {
  it("leaves gaps for empty days, flags over the limit and the single highest day", () => {
    const pts = sodiumPoints([d("2026-10-05", 1800, 2800), d("2026-10-06", 0, 0, 0), d("2026-10-07", 1800, 1200)], 2000);
    expect(pts.map((p) => p.sodium)).toEqual([2800, null, 1200]);
    expect(pts.map((p) => p.over)).toEqual([true, false, false]);
    expect(pts.map((p) => p.isMax)).toEqual([true, false, false]);
  });
  it("has no max when nothing was logged", () => {
    expect(sodiumPoints([d("2026-10-07", 0, 0, 0)], 2000).some((p) => p.isMax)).toBe(false);
  });
});

describe("niceAxis", () => {
  it("gives the mock's 0 / 1k / 2k for a ~2,000 kcal week and clears the target", () => {
    const a = niceAxis(2311, 2050);
    expect(a.ticks).toEqual([0, 1000, 2000]);
    expect(a.max).toBeGreaterThan(2050);
  });
  it("uses smaller steps for small values and never returns an empty axis", () => {
    expect(niceAxis(900, 0).ticks).toEqual([0, 250, 500, 750]);
    expect(niceAxis(0, 0).ticks[0]).toBe(0);
  });
});

describe("labelledDates", () => {
  it("labels every day of a week and every 7th day of a month ending today", () => {
    const week = Array.from({ length: 7 }, (_, i) => ({ date: `w${i}` }));
    expect(labelledDates(week)).toHaveLength(7);
    const month = Array.from({ length: 30 }, (_, i) => ({ date: `m${i}` }));
    expect(labelledDates(month)).toEqual(["m1", "m8", "m15", "m22", "m29"]);
  });
});

describe("balanceRows", () => {
  it("only flags limits over 100, never targets", () => {
    const rows = balanceRows({ protein: 140, fibre: 50, energy: 120, sugars: 101, sodium: 100, satFat: 150 });
    expect(rows.filter((r) => r.over).map((r) => r.key)).toEqual(["sugars", "satFat"]);
  });
});
