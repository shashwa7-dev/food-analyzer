import { afterEach, describe, expect, it, vi } from "vitest";
import { allows, lockedFeatures, PLANS, type GatedFeature } from "./plans";

const GATED: GatedFeature[] = ["progressMonth", "dataExport", "customTargets"];

describe("allows", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("opens every gated feature to every plan while enforcement is off", () => {
    for (const f of GATED) {
      expect(allows("basic", f, false)).toBe(true);
      expect(allows("pro", f, false)).toBe(true);
    }
  });

  it("follows each plan's own features once enforced", () => {
    for (const f of GATED) {
      expect(allows("basic", f, true)).toBe(false);
      expect(allows("pro", f, true)).toBe(true);
    }
  });

  it("reads PRO_GATES_ENFORCED when no switch is passed (off by default)", () => {
    vi.stubEnv("PRO_GATES_ENFORCED", "");
    expect(allows("basic", "progressMonth")).toBe(true);
    vi.stubEnv("PRO_GATES_ENFORCED", "true");
    expect(allows("basic", "progressMonth")).toBe(false);
    expect(allows("pro", "progressMonth")).toBe(true);
    vi.stubEnv("PRO_GATES_ENFORCED", "yes");
    expect(() => allows("basic", "progressMonth")).toThrow(/PRO_GATES_ENFORCED/);
  });

  it("keeps the AI-scan allowances", () => {
    expect(PLANS.basic.aiScansPerMonth).toBe(20);
    expect(PLANS.pro.aiScansPerMonth).toBe(200);
  });
});

describe("lockedFeatures", () => {
  it("locks nothing while enforcement is off", () => {
    expect(lockedFeatures("basic", false)).toEqual({ progressMonth: false, dataExport: false, customTargets: false });
  });
  it("locks every gated feature for Basic once enforced, and none for Pro", () => {
    expect(lockedFeatures("basic", true)).toEqual({ progressMonth: true, dataExport: true, customTargets: true });
    expect(lockedFeatures("pro", true)).toEqual({ progressMonth: false, dataExport: false, customTargets: false });
  });
});
