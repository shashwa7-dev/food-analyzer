import { describe, expect, it } from "vitest";
import { dropImplausible, implausibleKeys, outOfRangeKeys, PER100_MAX } from "./plausible";

const base = { energyKcal: 129, protein: 4.3, carbs: 12.1, fat: 6.8 };

describe("plausibility bounds", () => {
  it("drops a sodium unit error (Ashoka Dal Makhani, 350,428 mg/100 g) and keeps a salty-but-real value", () => {
    expect(dropImplausible({ ...base, sodiumMg: 350_428 }).per100.sodiumMg).toBeUndefined();
    expect(dropImplausible({ ...base, sodiumMg: 39_000 }).per100.sodiumMg).toBe(39_000); // near pure salt
    expect(dropImplausible({ ...base, sodiumMg: 40_000 }).per100.sodiumMg).toBe(40_000); // the bound itself is kept
    expect(dropImplausible({ ...base, sodiumMg: 40_001 }).per100.sodiumMg).toBeUndefined();
  });

  it("drops, never clamps: the value becomes unknown and is reported", () => {
    const r = dropImplausible({ ...base, satFat: 2, sodiumMg: 350_428 });
    expect(r.per100).toEqual({ ...base, satFat: 2 });
    expect("sodiumMg" in r.per100).toBe(false);
    expect(r.dropped).toEqual(["sodiumMg"]);
    expect(r.badCore).toEqual([]);
  });

  it("returns the same object when everything is plausible", () => {
    const n = { ...base, sugars: 3, satFat: 2, fibre: 4, sodiumMg: 500 };
    const r = dropImplausible(n);
    expect(r.per100).toBe(n);
    expect(r.dropped).toEqual([]);
  });

  it("bounds every nutrient: energy 910 kcal, macros/fibre 100 g, sodium 40,000 mg", () => {
    expect(PER100_MAX).toMatchObject({ energyKcal: 910, protein: 100, carbs: 100, fat: 100, fibre: 100, sodiumMg: 40_000 });
    expect(implausibleKeys({ ...base, fibre: 101 })).toEqual(["fibre"]);
    expect(implausibleKeys({ energyKcal: 902, protein: 0, carbs: 0, fat: 100 })).toEqual([]); // FNDDS lard
    expect(implausibleKeys({ energyKcal: 950, protein: 0, carbs: 0, fat: 100 })).toEqual(["energyKcal"]);
  });

  it("treats negative and non-finite values as implausible", () => {
    expect(implausibleKeys({ ...base, sugars: -1, satFat: Number.NaN, sodiumMg: Number.POSITIVE_INFINITY })).toEqual(["sugars", "satFat", "sodiumMg"]);
  });

  it("drops a part larger than its whole beyond the slack (1 g or 5 %)", () => {
    expect(implausibleKeys({ ...base, carbs: 0, sugars: 53.8 })).toEqual(["sugars"]); // OFF "Melody"
    expect(implausibleKeys({ ...base, fat: 0, satFat: 2 })).toEqual(["satFat"]);
    expect(implausibleKeys({ ...base, fat: 1, transFat: 2.5 })).toEqual(["transFat"]);
    expect(implausibleKeys({ ...base, carbs: 10, sugars: 8, addedSugars: 9.5 })).toEqual(["addedSugars"]);
  });

  it("keeps reference-table noise within the slack", () => {
    expect(implausibleKeys({ energyKcal: 717, protein: 0.9, carbs: 0.06, fat: 82.2, sugars: 0.58 })).toEqual([]); // FNDDS butter
    expect(implausibleKeys({ energyKcal: 321, protein: 21, carbs: 22.5, fat: 15.5, sugars: 23.3 })).toEqual([]); // FNDDS paneer
    expect(implausibleKeys({ ...base, carbs: 30, sugars: 31.5 })).toEqual([]); // 5 % of 30 = 1.5
    expect(implausibleKeys({ ...base, carbs: 30, sugars: 31.6 })).toEqual(["sugars"]);
  });

  it("checks added sugars against carbs when sugars are missing or themselves implausible", () => {
    expect(implausibleKeys({ ...base, carbs: 5, addedSugars: 9 })).toEqual(["addedSugars"]);
    expect(implausibleKeys({ ...base, carbs: 5, sugars: 50, addedSugars: 9 })).toEqual(["sugars", "addedSugars"]);
  });

  it("doesn't blame a part for an absurd whole: the whole is reported on its own", () => {
    expect(implausibleKeys({ energyKcal: 500, protein: 1, carbs: 2, fat: 3227, satFat: 20 })).toEqual(["fat"]); // OFF "haldirams mixture"
  });

  it("reports implausible energy or macros as badCore without removing them (they're required)", () => {
    const r = dropImplausible({ energyKcal: 400, protein: 200, carbs: 339, fat: 2, sugars: 250, sodiumMg: 80_000 });
    expect(r.badCore).toEqual(["protein", "carbs"]);
    expect(r.per100).toMatchObject({ protein: 200, carbs: 339 });
    expect(r.dropped).toEqual(["sugars", "sodiumMg"]);
  });

  it("outOfRangeKeys is the range half only (no part-of-whole checks)", () => {
    expect(outOfRangeKeys({ ...base, carbs: 0, sugars: 50, sodiumMg: 50_000 })).toEqual(["sodiumMg"]);
  });
});
