import { describe, expect, it } from "vitest";
import { fmtChange, fmtWeight, trendPoints, weightAxis } from "./weight-view";

describe("fmtWeight / fmtChange", () => {
  it("formats to one decimal", () => {
    expect(fmtWeight(72.04)).toBe("72");
    expect(fmtWeight(72.45)).toBe("72.5");
  });
  it("signs the change with a true minus", () => {
    expect(fmtChange(-1.4)).toBe("−1.4 kg");
    expect(fmtChange(0.31)).toBe("+0.3 kg");
    expect(fmtChange(0.01)).toBe("No change");
    expect(fmtChange(null)).toBeNull();
  });
});

describe("trendPoints", () => {
  it("keeps the 30 days ending at the newest entry, oldest first", () => {
    const entries = [
      { date: "2026-10-08", kg: 72 },
      { date: "2026-09-09", kg: 73.4 },
      { date: "2026-09-08", kg: 74 },
    ];
    expect(trendPoints(entries)).toEqual([{ date: "2026-09-09", kg: 73.4 }, { date: "2026-10-08", kg: 72 }]);
    expect(trendPoints([])).toEqual([]);
  });
});

describe("weightAxis", () => {
  it("covers the points and the goal with whole-kg ticks", () => {
    const a = weightAxis([72, 73.4], 70);
    expect(a.min).toBeLessThanOrEqual(69.5);
    expect(a.max).toBeGreaterThanOrEqual(73.9);
    expect(a.ticks[0]).toBe(a.min);
    expect(a.ticks.at(-1)).toBe(a.max);
    expect(a.ticks.length).toBeGreaterThanOrEqual(3);
    expect(a.ticks.length).toBeLessThanOrEqual(5);
  });
  it("spans at least 2 kg", () => {
    expect(weightAxis([72], null)).toEqual({ min: 71, max: 73, ticks: [71, 72, 73] });
  });
});
