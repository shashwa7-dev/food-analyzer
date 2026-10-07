import { describe, expect, it } from "vitest";
import { gradeFood } from "@/lib/nutrition/grade";
import type { FoodRow } from "./types";
import { plausibleFood } from "./sane";

// The stored Open Food Facts row for "Ashoka Dal Makhani" (food 0bc2f747…): sodium keyed in mg where g was meant.
const per100 = { energyKcal: 129.286, protein: 4.286, carbs: 12.143, fat: 6.786, sugars: 0, satFat: 1.286, sodiumMg: 350_428.558 };
const stored = gradeFood({ gradeCategory: "general", per100 });
const row = {
  source: "off", name: "Dal Makhani", categories: ["en:meals"], gradeCategory: "general", per100,
  gradePortionGrams: null, additives: [], nova: null, gradeFrozen: false,
  provenance: { energyKcal: "community", protein: "community", carbs: "community", fat: "community", sugars: "community", satFat: "community", sodiumMg: "community" },
  grade: stored.grade, gradeValue: stored.value, gradeComponents: stored.components,
} satisfies Partial<FoodRow> as unknown as FoodRow;

describe("plausibleFood (read-time guard)", () => {
  it("the stored row's grade really is driven by the bad sodium (salt at its 20-point max)", () => {
    expect(stored.grade).toBe("E");
    expect(stored.components.find((c) => c.key === "salt")).toMatchObject({ points: 20, estimated: false });
  });

  it("drops the absurd sodium, its provenance, and regrades on what's shown", () => {
    const f = plausibleFood(row);
    expect(f.per100.sodiumMg).toBeUndefined();
    expect(f.per100).toMatchObject({ energyKcal: 129.286, satFat: 1.286 });
    expect(f.provenance.sodiumMg).toBeUndefined();
    expect(f.provenance.satFat).toBe("community");
    const fresh = gradeFood({ gradeCategory: "general", per100: f.per100 });
    expect(f.grade).toBe(fresh.grade);
    expect(f.grade).not.toBe("E");
    expect(f.gradeComponents.find((c) => c.key === "salt")).toMatchObject({ points: 0, estimated: true });
    expect(f.gradeValue).toBe(fresh.value);
    expect(f.dropped).toEqual(["sodiumMg"]);
  });

  it("doesn't touch the input row", () => {
    plausibleFood(row);
    expect(row.per100.sodiumMg).toBe(350_428.558);
    expect(row.grade).toBe("E");
  });

  it("keeps a frozen grade (a scan snapshot) while still hiding the value", () => {
    const f = plausibleFood({ ...row, gradeFrozen: true });
    expect(f.per100.sodiumMg).toBeUndefined();
    expect(f.grade).toBe("E");
  });

  it("returns a plausible row as it is (same object)", () => {
    const ok = { ...row, per100: { ...per100, sodiumMg: 480 } };
    expect(plausibleFood(ok)).toBe(ok);
  });
});
