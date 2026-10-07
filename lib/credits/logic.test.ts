import { describe, expect, it } from "vitest";
import { allowanceFor, currentPeriod, nextPeriodStart } from "./logic";

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
