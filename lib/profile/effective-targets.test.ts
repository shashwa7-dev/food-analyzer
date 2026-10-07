import { afterEach, describe, expect, it, vi } from "vitest";
import { PRESETS } from "@/lib/nutrition/targets";
import { effectiveTargets, showTargetsNotice } from "./effective-targets";

const custom = { energyKcal: 2400, protein: 140 };

describe("effectiveTargets", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("gives Basic the goal's preset once enforced, ignoring stored overrides", () => {
    expect(effectiveTargets({ plan: "basic", goal: "muscle", targets: custom }, true)).toEqual(PRESETS.muscle);
  });

  it("applies Pro's overrides once enforced", () => {
    expect(effectiveTargets({ plan: "pro", goal: "muscle", targets: custom }, true)).toEqual({ ...PRESETS.muscle, ...custom });
  });

  it("applies overrides for everyone while enforcement is off", () => {
    for (const plan of ["basic", "pro"] as const) {
      expect(effectiveTargets({ plan, goal: "general", targets: custom }, false)).toEqual({ ...PRESETS.general, ...custom });
    }
  });

  it("is the preset with no overrides stored", () => {
    expect(effectiveTargets({ plan: "pro", goal: "low_sodium", targets: null }, true)).toEqual(PRESETS.low_sodium);
  });

  it("reads PRO_GATES_ENFORCED when no switch is passed", () => {
    vi.stubEnv("PRO_GATES_ENFORCED", "true");
    expect(effectiveTargets({ plan: "basic", goal: "general", targets: custom })).toEqual(PRESETS.general);
    vi.stubEnv("PRO_GATES_ENFORCED", "");
    expect(effectiveTargets({ plan: "basic", goal: "general", targets: custom }).energyKcal).toBe(2400);
  });
});

describe("showTargetsNotice", () => {
  const basic = { plan: "basic" as const, targets: custom, notices: {} };

  it("shows for Basic with stored overrides once enforced", () => {
    expect(showTargetsNotice(basic, true)).toBe(true);
  });

  it("is gone after dismissal", () => {
    expect(showTargetsNotice({ ...basic, notices: { targetsReset: true } }, true)).toBe(false);
  });

  it("never shows while enforcement is off, for Pro, or with nothing stored", () => {
    expect(showTargetsNotice(basic, false)).toBe(false);
    expect(showTargetsNotice({ ...basic, plan: "pro" }, true)).toBe(false);
    expect(showTargetsNotice({ ...basic, targets: null }, true)).toBe(false);
    expect(showTargetsNotice({ ...basic, targets: {} }, true)).toBe(false);
  });
});
