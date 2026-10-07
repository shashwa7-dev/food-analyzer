import { describe, expect, it } from "vitest";
import { categoriesFromGuess, tipFor } from "./tips";

describe("tipFor", () => {
  it("returns the snack tip for salty snacks / snacks", () => {
    expect(tipFor(["en:snacks", "en:salty-snacks"])).toBe("Roasted chana or makhana are lower in fat and sodium.");
    expect(tipFor(["en:snacks"])).toBe("Roasted chana or makhana are lower in fat and sodium.");
  });
  it("returns the drinks tip for sodas / beverages", () => {
    expect(tipFor(["en:beverages", "en:sodas"])).toBe("Try plain water, unsweetened lassi or nimbu pani without sugar.");
    expect(tipFor(["en:beverages"])).toBe("Try plain water, unsweetened lassi or nimbu pani without sugar.");
  });
  it("prefers the more specific tag (biscuits over snacks)", () => {
    expect(tipFor(["en:snacks", "en:sweet-snacks", "en:biscuits"])).toBe("Plain roasted nuts or fruit are better snack choices.");
  });
  it("returns undefined for an unmapped or empty category list", () => {
    expect(tipFor(["en:breakfast-cereals-xyz"])).toBeUndefined();
    expect(tipFor([])).toBeUndefined();
  });
});

describe("categoriesFromGuess", () => {
  it("maps namkeen/snack guesses to OFF salty-snack tags", () => {
    expect(categoriesFromGuess("Namkeen / savoury snack")).toEqual(["en:snacks", "en:salty-snacks"]);
    expect(categoriesFromGuess("Potato chips")).toEqual(["en:snacks", "en:salty-snacks"]);
  });
  it("maps soft drinks to beverages + sodas, water to beverages + waters", () => {
    expect(categoriesFromGuess("Carbonated soft drink")).toEqual(["en:beverages", "en:sodas"]);
    expect(categoriesFromGuess("Packaged drinking water")).toEqual(["en:beverages", "en:waters"]);
  });
  it("maps oils/ghee to fats and cheese/paneer to cheeses", () => {
    expect(categoriesFromGuess("Refined sunflower oil")).toEqual(["en:fats", "en:vegetable-oils"]);
    expect(categoriesFromGuess("Ghee")).toEqual(["en:fats"]);
    expect(categoriesFromGuess("Peanut butter")).toEqual([]);
    expect(categoriesFromGuess("Processed cheese slices")).toEqual(["en:cheeses"]);
  });
  it("maps biscuits", () => {
    expect(categoriesFromGuess("Cream biscuits")).toEqual(["en:snacks", "en:sweet-snacks", "en:biscuits"]);
  });
  it("returns [] for no guess or an unmapped guess (grades as general)", () => {
    expect(categoriesFromGuess(undefined)).toEqual([]);
    expect(categoriesFromGuess("Breakfast cereal")).toEqual([]);
  });
});
