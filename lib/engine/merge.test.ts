import { describe, expect, it } from "vitest";
import { mergeFacts } from "./merge";
import type { Nutrients } from "@/lib/nutrition/types";

const dbPer100: Nutrients = { energyKcal: 200, protein: 5, carbs: 30, fat: 6, fibre: 2, sodiumMg: 300 };

describe("mergeFacts", () => {
  it("returns null when both label and db are null", () => {
    expect(mergeFacts(null, null)).toBeNull();
  });

  it("uses db values with db provenance when there is no label", () => {
    const out = mergeFacts(null, { per100: dbPer100, provenance: { energyKcal: "reference" } });
    expect(out?.per100).toEqual(dbPer100);
    expect(out?.provenance.energyKcal).toBe("reference");
    expect(out?.provenance.fibre).toBe("reference");
  });

  it("label overrides db field-by-field with provenance label", () => {
    const label: Partial<Nutrients> = { energyKcal: 210, protein: 6 };
    const out = mergeFacts(label, { per100: dbPer100, provenance: { energyKcal: "reference" } });
    expect(out?.per100.energyKcal).toBe(210);
    expect(out?.provenance.energyKcal).toBe("label");
    expect(out?.per100.protein).toBe(6);
    expect(out?.provenance.protein).toBe("label");
    // db fills the gap for carbs/fat/fibre/sodiumMg
    expect(out?.per100.carbs).toBe(30);
    expect(out?.provenance.carbs).toBe("reference");
    expect(out?.per100.fibre).toBe(2);
  });

  it("uses label alone when there is no db match", () => {
    const label: Partial<Nutrients> = { energyKcal: 100, protein: 2, carbs: 10, fat: 1 };
    const out = mergeFacts(label, null);
    expect(out?.per100).toEqual(label);
    expect(out?.provenance.energyKcal).toBe("label");
  });

  it("returns null when required macros are missing from both sources", () => {
    expect(mergeFacts({ fibre: 2 }, null)).toBeNull();
  });
});
