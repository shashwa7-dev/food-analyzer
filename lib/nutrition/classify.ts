import type { GradeCategory } from "./types";

type Kind = "dish" | "generic" | "packaged" | "ingredient";
// An ingredient is a name that IS a cooking basic (optionally with a qualifier), not a dish that mentions one.
const BASIC_INGREDIENT = /^(pure |desi |refined |cow |buffalo |table |rock |black )?(ghee|oil|[a-z]+ oil|vanaspati|butter|salt|sugar|jaggery|gur|honey|vinegar|baking soda|[a-z ]*masala powder|garam masala|[a-z ]*spice mix|[a-z ]*powder)( \([^)]*\))?$/i;
// FNDDS only — INDB contains only cooked recipes, so this would misclassify dishes like
// "Gram flour and semolina dhokla" or "Cabbage rolls (dry)" as ingredients.
const RAW_INGREDIENT = /\b(raw|flour|atta|besan|maida|uncooked)\b/i;
const FNDDS_DISH = /mixed dishes|soups?|sandwich|burgers?|pizza|burritos|tacos|stir-fr|fried rice|egg rolls|dumplings|curr(y|ies)|macaroni and cheese|lasagna|pasta/i;
const FNDDS_DRINK = /coffee|tea|soft drinks|juice|nectar|smoothies|sport and energy drinks|diet soft drinks|beer|wine|liquor|flavored milk|milk shakes|plant-based milk|nutritional beverages/i;
const FNDDS_WATER = /water/i;
const FNDDS_NONE = /vegetable oils|butter and animal fats|margarine|sugars and honey|sugar substitutes|condiments|mustard and other condiments|salad dressings|gravies/i;

export function classify(input: {
  source: "indb" | "fndds" | "off" | "crowd" | "custom"; name: string; categories?: string[]; wweia?: string; perServingEntry?: boolean;
}): { kind: Kind; gradeCategory: GradeCategory } {
  const cats = input.categories ?? [];
  switch (input.source) {
    case "indb":
      // INDB contains only cooked recipes — RAW_INGREDIENT is not applied here (it would catch words
      // like "flour" or "dry" that appear in dish names, e.g. "Gram flour and semolina dhokla").
      if (BASIC_INGREDIENT.test(input.name.trim())) return { kind: "ingredient", gradeCategory: "none" };
      return { kind: "dish", gradeCategory: "dish" };
    case "fndds": {
      const w = input.wweia ?? "";
      if (FNDDS_NONE.test(w)) return { kind: "ingredient", gradeCategory: "none" };
      if (FNDDS_WATER.test(w) && !FNDDS_DRINK.test(w)) return { kind: "generic", gradeCategory: "water" };
      if (FNDDS_DRINK.test(w)) return { kind: "generic", gradeCategory: "beverage" };
      if (FNDDS_DISH.test(w)) return { kind: "dish", gradeCategory: "dish" };
      if (RAW_INGREDIENT.test(input.name)) return { kind: "ingredient", gradeCategory: "general" };
      return { kind: "generic", gradeCategory: "general" };
    }
    case "off":
    case "crowd": {
      const has = (t: string) => cats.includes(t);
      if (has("en:waters")) return { kind: "packaged", gradeCategory: "water" };
      if (has("en:beverages")) return { kind: "packaged", gradeCategory: "beverage" };
      if (has("en:fats") || has("en:vegetable-oils")) return { kind: "packaged", gradeCategory: "fat_oil" };
      if (has("en:cheeses")) return { kind: "packaged", gradeCategory: "cheese" };
      return { kind: "packaged", gradeCategory: "general" };
    }
    case "custom":
      return input.perServingEntry ? { kind: "dish", gradeCategory: "dish" } : { kind: "generic", gradeCategory: "general" };
  }
}
