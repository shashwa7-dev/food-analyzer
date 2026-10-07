import { describe, expect, it } from "vitest";
import { toPer100 } from "./convert";
import type { Extraction } from "./schema";

type Facts = NonNullable<Extraction["facts"]>;

describe("toPer100", () => {
  it("scales per_serving facts to per100", () => {
    const facts: Facts = { basis: "per_serving", servingSize: { value: 30, unit: "g" }, energyKcal: 168, protein: 3, carbs: 20, fat: 6 };
    const out = toPer100(facts);
    expect(out?.basis).toBe("per_100g");
    expect(out?.servingGrams).toBe(30);
    expect(out?.per100.energyKcal).toBe(560);
  });

  it("passes per_100ml facts through with basis per_100ml", () => {
    const facts: Facts = { basis: "per_100ml", energyKcal: 40, protein: 1, carbs: 5, fat: 1 };
    const out = toPer100(facts);
    expect(out?.basis).toBe("per_100ml");
    expect(out?.per100.energyKcal).toBe(40);
    expect(out?.servingGrams).toBeNull();
  });

  it("per_serving without a serving size: returns per-serving values as per100 with servingGrams null and servingUnknown true", () => {
    const facts: Facts = { basis: "per_serving", energyKcal: 150, protein: 5, carbs: 20, fat: 4 };
    const out = toPer100(facts);
    expect(out).not.toBeNull();
    expect(out?.servingGrams).toBeNull();
    expect(out?.servingUnknown).toBe(true);
    expect(out?.per100.energyKcal).toBe(150);
  });

  it("returns null when energyKcal is missing", () => {
    const facts: Facts = { basis: "per_100g", protein: 1, carbs: 5, fat: 1 } as Facts;
    expect(toPer100(facts)).toBeNull();
  });

  it("returns null when any of protein/carbs/fat is missing", () => {
    const facts: Facts = { basis: "per_100g", energyKcal: 100, protein: 1, carbs: 5 } as Facts;
    expect(toPer100(facts)).toBeNull();
  });

  it("returns null when facts is undefined", () => {
    expect(toPer100(undefined)).toBeNull();
  });

  it("derives sodiumMg from saltG when only salt is printed", () => {
    const facts: Facts = { basis: "per_100g", energyKcal: 100, protein: 1, carbs: 5, fat: 1, saltG: 1 };
    const out = toPer100(facts);
    expect(out?.per100.sodiumMg).toBe(400);
    expect(out?.saltG).toBe(1);
  });

  it("converts energyKj and saltG to per-100 scale alongside the macros", () => {
    const facts: Facts = { basis: "per_serving", servingSize: { value: 50, unit: "g" }, energyKcal: 100, protein: 2, carbs: 10, fat: 3, energyKj: 418, saltG: 0.5 };
    const out = toPer100(facts);
    expect(out?.energyKj).toBe(836);
    expect(out?.saltG).toBe(1);
  });

  it("does not clamp out-of-range per-100 values (validateFacts flags range separately)", () => {
    const facts: Facts = { basis: "per_100g", energyKcal: 950, protein: 150, carbs: 10, fat: 5 };
    const out = toPer100(facts);
    expect(out?.per100.energyKcal).toBe(950);
    expect(out?.per100.protein).toBe(150);
  });
});
