import { describe, expect, it } from "vitest";
import { allowanceFor, currentPeriod, nextPeriodStart, balanceIfCurrent } from "./logic";

describe("credits/logic", () => {
  describe("currentPeriod", () => {
    it("returns the UTC year-month for a date late in the month", () => {
      expect(currentPeriod(new Date("2026-10-31T23:59:59Z"))).toBe("2026-10");
    });
    it("rolls over at the UTC month boundary", () => {
      expect(currentPeriod(new Date("2026-11-01T00:00:00Z"))).toBe("2026-11");
    });
  });

  describe("nextPeriodStart", () => {
    it("returns the 1st of next month at UTC midnight", () => {
      expect(nextPeriodStart(new Date("2026-10-15T12:34:56Z")).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    });
    it("rolls over from December to January of the next year", () => {
      expect(nextPeriodStart(new Date("2026-12-15T12:34:56Z")).toISOString()).toBe("2027-01-01T00:00:00.000Z");
    });
  });

  describe("allowanceFor", () => {
    it("returns the basic plan's monthly AI scan allowance", () => {
      expect(allowanceFor("basic")).toBe(20);
    });
    it("returns the pro plan's monthly AI scan allowance", () => {
      expect(allowanceFor("pro")).toBe(200);
    });
  });
});

describe("balanceIfCurrent", () => {
  const now = new Date("2026-10-09T12:00:00Z");
  it("reads the balance straight off a row that is already in this period", () => {
    expect(balanceIfCurrent({ plan: "basic", credits: 7, allowancePeriod: "2026-10" }, now)).toEqual({
      credits: 7, allowance: allowanceFor("basic"), periodResetsAt: new Date("2026-11-01T00:00:00Z"),
    });
    expect(balanceIfCurrent({ plan: "pro", credits: 0, allowancePeriod: "2026-10" }, now)?.allowance).toBe(allowanceFor("pro"));
  });
  it("is null when the period has to roll over first: never granted, or an earlier month", () => {
    expect(balanceIfCurrent({ plan: "basic", credits: 5, allowancePeriod: null }, now)).toBeNull();
    expect(balanceIfCurrent({ plan: "basic", credits: 5, allowancePeriod: "2026-09" }, now)).toBeNull();
    expect(balanceIfCurrent({ plan: "basic", credits: 5, allowancePeriod: "2025-12" }, now)).toBeNull();
  });
  it("trusts a row from a later period, as the reset does (a skewed clock never rolls a balance back)", () => {
    expect(balanceIfCurrent({ plan: "basic", credits: 3, allowancePeriod: "2026-11" }, now)?.credits).toBe(3);
  });
});
