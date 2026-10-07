import { describe, expect, it } from "vitest";
import { cleanMicros, microsFromINDB, microsFromOFF } from "./micros-map";
import { toSourceRecordOFF } from "./off-map";

describe("cleanMicros", () => {
  it("keeps positive finite values to three significant figures, drops zero, negative and missing", () => {
    expect(cleanMicros({ ironMg: 1.23456, vitaminB12Ug: 0.000241, calciumMg: 0, zincMg: -1, vitaminCMg: Number.NaN, folateUg: undefined }))
      .toEqual({ ironMg: 1.23, vitaminB12Ug: 0.000241 });
  });
});

describe("INDB micros", () => {
  const row = {
    cholesterol_mg: 121.19, calcium_mg: 17.75, iron_mg: 0.64, potassium_mg: 120, magnesium_mg: 10, zinc_mg: 1.1, phosphorus_mg: 180,
    vita_ug: 65.56, carotenoids_ug: 52.05, vitd2_ug: 0.09, vitd3_ug: 0.28, vitk1_ug: 0.57, vitk2_ug: 4.84, folate_ug: 16.4,
    vitb1_mg: 0.05, vitb2_mg: 0.4, vitb3_mg: 0.07, vitb6_mg: 0.12, vitc_mg: 0, vite_mg: 1.03,
  }; // Boiled egg (Ubla anda)

  it("maps the INDB columns, summing D2 + D3 and K1 + K2", () => {
    const m = microsFromINDB(row);
    expect(m).toMatchObject({ cholesterolMg: 121, calciumMg: 17.8, ironMg: 0.64, vitaminDUg: 0.37, vitaminKUg: 5.41, folateUg: 16.4, thiaminMg: 0.05, niacinMg: 0.07 });
    expect(m.vitaminCMg).toBeUndefined(); // 0 means nothing here
    expect(m.vitaminB12Ug).toBeUndefined(); // INDB has no B12 column
  });

  it("uses retinol for vitamin A only where carotenoids can't move it more than a tenth (animal foods)", () => {
    expect(microsFromINDB(row).vitaminAUg).toBeCloseTo(69.9, 1); // 65.56 + 52.05 / 12
    expect(microsFromINDB({ vita_ug: 0, carotenoids_ug: 5906 }).vitaminAUg).toBeUndefined(); // palak paneer: no guess
    expect(microsFromINDB({ vita_ug: 92.19, carotenoids_ug: 2763 }).vitaminAUg).toBeUndefined(); // shahi paneer: mostly carotenoids
  });
});

describe("OFF micros", () => {
  it("scales OFF's grams to mg and µg", () => {
    expect(microsFromOFF({ calcium_100g: 0.12, iron_100g: 0.0021, "vitamin-a_100g": 0.00006, "vitamin-d_100g": 0.0000012, "vitamin-b12_100g": 0.0000004, "vitamin-pp_100g": 0.0035, folates_100g: 0.00005 }))
      .toEqual({ calciumMg: 120, ironMg: 2.1, vitaminAUg: 60, vitaminDUg: 1.2, vitaminB12Ug: 0.4, niacinMg: 3.5, folateUg: 50 });
  });

  it("carries micros and trans fat through the OFF record, dropping a unit slip", () => {
    const rec = toSourceRecordOFF({
      code: "1", product_name: "Paneer",
      nutriments: { "energy-kcal_100g": 289, proteins_100g: 14, carbohydrates_100g: 2, fat_100g: 25, "trans-fat_100g": 0.2, calcium_100g: 0.48, iron_100g: 9 },
    })!;
    expect(rec.per100).toMatchObject({ transFat: 0.2, calciumMg: 480 });
    expect(rec.per100.ironMg).toBeUndefined(); // 9 g of iron per 100 g
  });
});
