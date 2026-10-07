import { describe, expect, it } from "vitest";
import { balanceTakeaway, compact, dayMonth, gradeTakeaway, weekdayLetter, weekdayShort } from "./copy";

describe("balanceTakeaway", () => {
  it("says a limit's data is incomplete instead of within, when nothing known is over", () => {
    expect(balanceTakeaway({ range: "week", worstOverLimit: null, incomplete: ["sodium"] })).toBe("Sodium data is incomplete this week.");
    expect(balanceTakeaway({ range: "month", worstOverLimit: null, incomplete: ["sodium", "satFat", "sugars"] })).toBe("Sodium, sat fat and sugar data is incomplete this month.");
    expect(balanceTakeaway({ range: "week", worstOverLimit: null, incomplete: ["satFat", "sugars"] })).toBe("Sat fat and sugar data is incomplete this week.");
  });
  it("a limit over on the known values still says over", () => {
    expect(balanceTakeaway({ range: "week", worstOverLimit: { axis: "sodium", pct: 130 }, incomplete: ["sodium"] })).toBe("Sodium is 30% over your limit this week.");
  });
  it("names the worst axis and how far over, for the range", () => {
    expect(balanceTakeaway({ range: "week", worstOverLimit: { axis: "sodium", pct: 118 }, incomplete: [] })).toBe("Sodium is 18% over your limit this week.");
    expect(balanceTakeaway({ range: "month", worstOverLimit: { axis: "satFat", pct: 140 }, incomplete: [] })).toBe("Sat fat is 40% over your limit this month.");
  });
  it("says everything is within when nothing is over", () => {
    expect(balanceTakeaway({ range: "week", worstOverLimit: null, incomplete: [] })).toBe("Everything within your limits this week.");
    expect(balanceTakeaway({ range: "month", worstOverLimit: null, incomplete: [] })).toBe("Everything within your limits this month.");
  });
});

describe("gradeTakeaway", () => {
  it("sums A and B", () => {
    expect(gradeTakeaway({ A: 34, B: 30, C: 18, D: 12, E: 6 })).toBe("64% of your calories came from A and B foods.");
  });
  it("is null with no graded kcal", () => {
    expect(gradeTakeaway({ A: 0, B: 0, C: 0, D: 0, E: 0 })).toBeNull();
  });
});

describe("labels", () => {
  it("formats days without the host timezone", () => {
    expect(weekdayShort("2026-10-07")).toBe("Wed");
    expect(weekdayLetter("2026-10-05")).toBe("M");
    expect(dayMonth("2026-10-07")).toBe("7 Oct");
  });
  it("compacts axis numbers", () => {
    expect(compact(0)).toBe("0");
    expect(compact(500)).toBe("500");
    expect(compact(1000)).toBe("1k");
    expect(compact(1500)).toBe("1.5k");
  });
});
