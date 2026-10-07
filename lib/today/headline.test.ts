import { describe, expect, it } from "vitest";
import { dayLabels, headlineFor } from "./headline";

describe("headlineFor", () => {
  it("shows kcal left today", () => {
    expect(headlineFor({ eaten: 1240, target: 2050, isToday: true, dateLabel: "7 Oct" }))
      .toEqual({ lead: "You have", value: "810 kcal", tail: "left today" });
  });
  it("shows kcal over today", () => {
    expect(headlineFor({ eaten: 2300, target: 2050, isToday: true, dateLabel: "7 Oct" }))
      .toEqual({ lead: "You're", value: "250 kcal", tail: "over today" });
  });
  it("uses the date for past days", () => {
    expect(headlineFor({ eaten: 1000, target: 2050, isToday: false, dateLabel: "5 Oct" }))
      .toEqual({ lead: "", value: "1,050 kcal", tail: "left on 5 Oct" });
    expect(headlineFor({ eaten: 2100, target: 2050, isToday: false, dateLabel: "5 Oct" }))
      .toEqual({ lead: "", value: "50 kcal", tail: "over on 5 Oct" });
  });
  it("treats exactly on target as 0 left", () => {
    expect(headlineFor({ eaten: 2050, target: 2050, isToday: true, dateLabel: "7 Oct" }).value).toBe("0 kcal");
  });
});

describe("dayLabels", () => {
  it("formats the long and short labels from the calendar date, not the host timezone", () => {
    expect(dayLabels("2026-10-07")).toEqual({ long: "Wednesday, 7 Oct", short: "7 Oct" });
    expect(dayLabels("2026-09-12")).toEqual({ long: "Saturday, 12 Sep", short: "12 Sep" });
  });
});
