import type { GradeCategory, Nutrients } from "./types";

type Kind = "dish" | "generic" | "packaged" | "ingredient";
// An ingredient is a name that IS a cooking basic (optionally with a qualifier), not a dish that mentions one.
const BASIC_INGREDIENT = /^(pure |desi |refined |cow |buffalo |table |rock |black )?(ghee|oil|[a-z]+ oil|vanaspati|butter|salt|sugar|jaggery|gur|honey|vinegar|baking soda|[a-z ]*masala powder|garam masala|[a-z ]*spice mix|[a-z ]*powder)( \([^)]*\))?$/i;
// FNDDS only — INDB contains only cooked recipes, so this would misclassify dishes like
// "Gram flour and semolina dhokla" or "Cabbage rolls (dry)" as ingredients.
const RAW_INGREDIENT = /\b(flour|atta|besan|maida|uncooked)\b/i;
// "raw" marks an ingredient (raw meat, fish, eggs, grains) only outside fruit/vegetable categories.
const RAW_WORD = /\braw\b/i;
// WWEIA fruit/vegetable/legume categories (brief list plus the WWEIA names it misses: spinach, broccoli, …).
const FNDDS_FRUIT_VEG = /fruit|vegetable|berries|citrus|apples|bananas|grapes|melons|tomatoes|lettuce|greens|carrots|potatoes(?! chips)|beans, peas|legumes|spinach|broccoli|cabbage|onions|string beans|peaches|pears|pineapple|mango|strawberries/i;
const FNDDS_FRUIT_VEG_EXCLUDE = /juice|fried|fries|chips|drink/i;
const FNDDS_DISH = /mixed dishes|soups?|sandwich|burgers?|pizza|burritos|tacos|stir-fr|fried rice|egg rolls|dumplings|curr(y|ies)|macaroni and cheese|lasagna|pasta/i;
const FNDDS_DRINK = /coffee|tea|soft drinks|juice|nectar|smoothies|sport and energy drinks|diet soft drinks|beer|wine|liquor|flavored milk|milk shakes|plant-based milk|nutritional beverages/i;
const FNDDS_WATER = /water/i;
const FNDDS_NONE = /vegetable oils|butter and animal fats|margarine|sugars and honey|sugar substitutes|condiments|mustard and other condiments|salad dressings|gravies/i;

export function isFruitVegCategory(wweia: string | undefined): boolean {
  return !!wweia && FNDDS_FRUIT_VEG.test(wweia) && !FNDDS_FRUIT_VEG_EXCLUDE.test(wweia);
}

// Only near-zero sugar and energy drinks are graded as water (always A); tonic or flavoured "waters" are beverages.
export function isPlainWater(per100: Nutrients | undefined): boolean {
  return !per100 || ((per100.sugars ?? 0) <= 0.5 && per100.energyKcal <= 5);
}

export function classify(input: {
  source: "indb" | "fndds" | "off" | "crowd" | "custom"; name: string; categories?: string[]; wweia?: string; perServingEntry?: boolean;
  per100?: Nutrients;
}): { kind: Kind; gradeCategory: GradeCategory; fvlPercent?: number } {
  const cats = input.categories ?? [];
  const water = isPlainWater(input.per100) ? "water" as const : "beverage" as const;
  switch (input.source) {
    case "indb":
      // INDB contains only cooked recipes — RAW_INGREDIENT is not applied here (it would catch words
      // like "flour" or "dry" that appear in dish names, e.g. "Gram flour and semolina dhokla").
      if (BASIC_INGREDIENT.test(input.name.trim())) return { kind: "ingredient", gradeCategory: "none" };
      return { kind: "dish", gradeCategory: "dish" };
    case "fndds": {
      const w = input.wweia ?? "";
      if (FNDDS_NONE.test(w)) return { kind: "ingredient", gradeCategory: "none" };
      if (FNDDS_WATER.test(w) && !FNDDS_DRINK.test(w)) return { kind: "generic", gradeCategory: water };
      if (FNDDS_DRINK.test(w)) return { kind: "generic", gradeCategory: "beverage" };
      if (FNDDS_DISH.test(w)) return { kind: "dish", gradeCategory: "dish" };
      const fruitVeg = isFruitVegCategory(w);
      if (RAW_INGREDIENT.test(input.name) || (!fruitVeg && RAW_WORD.test(input.name))) return { kind: "ingredient", gradeCategory: "general" };
      return fruitVeg ? { kind: "generic", gradeCategory: "general", fvlPercent: 100 } : { kind: "generic", gradeCategory: "general" };
    }
    case "off":
    case "crowd": {
      const has = (t: string) => cats.includes(t);
      if (has("en:waters")) return { kind: "packaged", gradeCategory: water };
      if (has("en:beverages")) return { kind: "packaged", gradeCategory: "beverage" };
      if (has("en:fats") || has("en:vegetable-oils")) return { kind: "packaged", gradeCategory: "fat_oil" };
      if (has("en:cheeses")) return { kind: "packaged", gradeCategory: "cheese" };
      return { kind: "packaged", gradeCategory: "general" };
    }
    case "custom":
      return input.perServingEntry ? { kind: "dish", gradeCategory: "dish" } : { kind: "generic", gradeCategory: "general" };
  }
}
