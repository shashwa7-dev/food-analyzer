import { describe, expect, it } from "vitest";
import { toSourceRecordOFF, type OffRow } from "./off-map";

const row = (nutriments: Record<string, unknown>): OffRow => ({
  code: "8901234567890", product_name: "Dal Makhani", brands: "Ashoka",
  nutriments: { "energy-kcal_100g": 129.286, proteins_100g: 4.286, carbohydrates_100g: 12.143, fat_100g: 6.786, ...nutriments },
});

describe("toSourceRecordOFF plausibility", () => {
  it("drops a sodium unit error (350.43 g sodium per 100 g) instead of storing it", () => {
    const rec = toSourceRecordOFF(row({ sodium_100g: 350.428558, "saturated-fat_100g": 1.286 }))!;
    expect(rec.per100.sodiumMg).toBeUndefined();
    expect(rec.per100.satFat).toBe(1.286);
  });

  it("keeps a plausible sodium (from salt too)", () => {
    expect(toSourceRecordOFF(row({ sodium_100g: 0.6 }))!.per100.sodiumMg).toBe(600);
    expect(toSourceRecordOFF(row({ salt_100g: 2.5 }))!.per100.sodiumMg).toBe(1000);
  });

  it("drops sugars larger than carbs", () => {
    expect(toSourceRecordOFF(row({ carbohydrates_100g: 0, sugars_100g: 53.8 }))!.per100.sugars).toBeUndefined();
  });

  it("rejects a product whose energy or macros are implausible", () => {
    expect(toSourceRecordOFF(row({ fat_100g: 3227 }))).toBeNull();
    expect(toSourceRecordOFF(row({ "energy-kcal_100g": 1500 }))).toBeNull();
  });
});
