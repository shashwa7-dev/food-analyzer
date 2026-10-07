import { describe, expect, it } from "vitest";
import { addDays, DateSchema, defaultMealIn, formatLocalDate, isAllowedLogDate, parseLocalDate, relativeDate, todayIn } from "./dates";

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

describe("parseLocalDate / formatLocalDate", () => {
  it("round-trips without shifting a day, regardless of the host's UTC offset", () => {
    expect(formatLocalDate(parseLocalDate("2026-10-07"))).toBe("2026-10-07");
    expect(formatLocalDate(parseLocalDate("2026-01-01"))).toBe("2026-01-01");
    expect(formatLocalDate(parseLocalDate("2026-12-31"))).toBe("2026-12-31");
  });
  it("parses using local getters, not UTC ones", () => {
    const d = parseLocalDate("2026-10-07");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 7]);
  });
});

describe("relativeDate", () => {
  const tz = "Asia/Kolkata";
  const now = new Date("2026-10-07T12:00:00Z"); // 17:30 IST on 7 Oct

  it("ticks through the elapsed-time tiers within today's calendar day", () => {
    expect(relativeDate("2026-10-07T11:59:30Z", tz, now)).toBe("Just now");
    expect(relativeDate("2026-10-07T11:55:00Z", tz, now)).toBe("5 min ago");
    expect(relativeDate("2026-10-07T09:00:00Z", tz, now)).toBe("3 h ago");
    expect(relativeDate("2026-10-06T10:00:00Z", tz, now)).toBe("Yesterday"); // 26 h ago
  });
  it("falls back to an absolute date past ~two days", () => {
    expect(relativeDate("2026-09-12T08:00:00Z", tz, now)).toBe("12 Sep");
  });
  it("treats a clock-skewed future timestamp as Just now", () => {
    expect(relativeDate("2026-10-07T12:00:30Z", tz, now)).toBe("Just now");
  });
  it("uses the user's calendar day, not UTC, for a scan at 00:30 IST more than 48h old", () => {
    const later = new Date("2026-10-09T08:00:00Z"); // 13:30 IST on 9 Oct
    // 00:30 IST on 5 Oct is 19:00 UTC on 4 Oct — a UTC-anchored implementation would say "4 Oct".
    expect(relativeDate("2026-10-04T19:00:00Z", tz, later)).toBe("5 Oct");
  });
  it('shows "Yesterday" for 23:50 IST yesterday even just 20 minutes before 00:10 IST today', () => {
    const justAfterMidnight = new Date("2026-10-07T18:40:00Z"); // 00:10 IST on 8 Oct
    expect(relativeDate("2026-10-07T18:20:00Z", tz, justAfterMidnight)).toBe("Yesterday"); // 23:50 IST on 7 Oct
  });
});

describe("defaultMealIn", () => {
  it("picks the meal from the user's local hour", () => {
    expect(defaultMealIn("Asia/Kolkata", new Date("2026-10-07T02:30:00Z"))).toBe("breakfast"); // 08:00 IST
    expect(defaultMealIn("Asia/Kolkata", new Date("2026-10-07T07:30:00Z"))).toBe("lunch"); // 13:00
    expect(defaultMealIn("Asia/Kolkata", new Date("2026-10-07T12:00:00Z"))).toBe("snack"); // 17:30
    expect(defaultMealIn("Asia/Kolkata", new Date("2026-10-07T15:30:00Z"))).toBe("dinner"); // 21:00
    expect(defaultMealIn("UTC", new Date("2026-10-07T00:10:00Z"))).toBe("breakfast"); // midnight, never "24"
  });
});
