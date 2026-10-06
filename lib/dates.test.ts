import { describe, expect, it } from "vitest";
import { addDays, DateSchema, isAllowedLogDate, todayIn } from "./dates";

describe("todayIn", () => {
  it("uses the user's timezone, not UTC (00:30 IST is still the previous UTC day)", () => {
    const now = new Date("2026-10-06T19:00:00Z"); // 00:30 IST on 7 Oct
    expect(todayIn("Asia/Kolkata", now)).toBe("2026-10-07");
    expect(todayIn("UTC", now)).toBe("2026-10-06");
  });
});

describe("isAllowedLogDate", () => {
  const now = new Date("2026-10-06T12:00:00Z");
  it("allows the last year and tomorrow", () => {
    expect(isAllowedLogDate("2026-10-07", now)).toBe(true);
    expect(isAllowedLogDate("2025-10-07", now)).toBe(true);
  });
  it("rejects far future, very old and impossible dates", () => {
    expect(isAllowedLogDate("2026-10-09", now)).toBe(false);
    expect(isAllowedLogDate("2024-01-01", now)).toBe(false);
    expect(isAllowedLogDate("2026-02-30", now)).toBe(false);
  });
});

describe("addDays / DateSchema", () => {
  it("crosses month boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("validates format", () => {
    expect(DateSchema.safeParse("06-10-2026").success).toBe(false);
  });
});
