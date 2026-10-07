import { describe, expect, it } from "vitest";
import type { DayAgg } from "./aggregate";
import { balanceRows, calorieBars, labelSide, labelledDates, niceAxis, sodiumPoints } from "./chart-data";

const d = (date: string, kcal: number, sodiumMg: number, entries = 2): DayAgg => ({
  date, kcal, protein: 0, carbs: 0, fat: 0, fibre: 0, sugars: 0, sodiumMg, satFat: 0, entries, gradeKcal: {},
});

describe("calorieBars", () => {
  it("marks over strictly above the target, never on an empty day, and flags today", () => {
    const bars = calorieBars([d("2026-10-05", 2000, 0), d("2026-10-06", 2001, 0), d("2026-10-07", 0, 0, 0)], 2000, "2026-10-07");
    expect(bars.map((b) => b.over)).toEqual([false, true, false]);
    expect(bars.map((b) => b.isToday)).toEqual([false, false, true]);
    expect(bars[2]!.logged).toBe(false);
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

describe("labelSide", () => {
  it("keeps the preferred side unless the data crowds it", () => {
    expect(labelSide([1000, 1000, 1000], 2000, { prefer: "right" })).toBe("right");
    // the demo week: Thu over target on the left, Tue/Wed under on the right
    expect(labelSide([2407, 1361, null, 1573, 2489, 1256, 1183], 1700, { prefer: "right" })).toBe("right");
    const month = [...Array(20).fill(null), 2300, 1800, 2500, 1900, 2000, 1600, 2400, 1700, 1500, 1400];
    expect(labelSide(month, 1700, { prefer: "right" })).toBe("left");
  });
  it("checks the band under the line for a label below it", () => {
    // the demo week's sodium: Thu 2,421 and Fri 1,324 crowd the left, Tue/Wed ~1,100 crowd the right as well
    expect(labelSide([2421, 1324, null, 2567, 3053, 1392, 1117], 2000, { prefer: "left", below: true })).toBe("left");
    expect(labelSide([1900, 1800, null, 900, 3000, 500, 400], 2000, { prefer: "left", below: true })).toBe("right");
  });
});
