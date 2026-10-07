import { describe, expect, it } from "vitest";
import { creditsState, resetDayLabel } from "./display";
describe("creditsState", () => {
  it("is ok above 3", () => { expect(creditsState(4)).toBe("ok"); expect(creditsState(20)).toBe("ok"); });
  it("is low at 1–3", () => { expect(creditsState(3)).toBe("low"); expect(creditsState(1)).toBe("low"); });
  it("is empty at 0 or below", () => { expect(creditsState(0)).toBe("empty"); expect(creditsState(-1)).toBe("empty"); });
});

describe("resetDayLabel", () => {
  const resetsAt = new Date("2026-11-01T00:00:00Z");
  it("reads the reset day in the user's timezone", () => {
    expect(resetDayLabel(resetsAt, "Asia/Kolkata")).toBe("1 Nov");
    expect(resetDayLabel(resetsAt, "UTC")).toBe("1 Nov");
    expect(resetDayLabel(resetsAt, "America/New_York")).toBe("31 Oct");
  });
  it("uses fixed month abbreviations", () => {
    expect(resetDayLabel(new Date("2026-09-01T00:00:00Z"), "Asia/Kolkata")).toBe("1 Sep");
  });
});
