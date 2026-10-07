import { gradeFood } from "@/lib/nutrition/grade";
import { explain } from "@/lib/nutrition/explain";
import { OFF_TAG, personalise } from "@/lib/nutrition/personalise";
import { nutrientsFor } from "@/lib/nutrition/portions";
import type { DailyTargets, Diet, Flag, Goal, Grade, GradeCategory, NutrientKey, Nutrients, Portion, Provenance, Reason, ScoreComponent } from "@/lib/nutrition/types";
import type { FoodHit } from "@/lib/foods/types";

export interface ScanResult {
  kind: "packaged" | "dish" | "meal";
  name: string;
  brand: string | null;
  foodId: string | null;
  basis: "per_100g" | "per_100ml";
  per100: Nutrients;
  provenance: Partial<Record<NutrientKey, Provenance>>;
  portions: Portion[];
  defaultPortion: number;
  grade: Grade | null;
  gradeValue: number | null;
  components: ScoreComponent[];
  reasons: Reason[];
  flags: Flag[];
  ingredients: string[];
  items?: { name: string; grams: number; nutrients: Nutrients; provenance: Provenance }[];
  alternatives: FoodHit[];
  hints: string[];
  confidence: "high" | "medium" | "low";
  inputKind: "barcode" | "label" | "front" | "meal";
  tip?: string;
  servingUnknown?: boolean;
}

// Reverse of personalise's OFF_TAG map (OFF tag -> model allergen key): model-extracted
// allergen keys (peanut, tree_nut, milk, ...) need to become OFF tags before personalise,
// which only recognises declared/mayContain allergens as OFF tags (en:milk, en:peanuts, ...).
const ALLERGEN_KEY_TO_OFF_TAG: Record<string, string> = Object.fromEntries(Object.entries(OFF_TAG).map(([offTag, key]) => [key, offTag]));

export function toOffAllergenTags(keys: string[]): string[] {
  return keys.map((key) => ALLERGEN_KEY_TO_OFF_TAG[key]).filter((tag): tag is string => typeof tag === "string");
}

const FALLBACK_PORTION: Portion = { label: "100 g", amount: 100, unit: "g", grams: 100 };

export function buildResult(args: {
  name: string;
  brand: string | null;
  foodId: string | null;
  kind: "packaged" | "dish" | "meal";
  inputKind: "barcode" | "label" | "front" | "meal";
  basis: "per_100g" | "per_100ml";
  per100: Nutrients;
  provenance: Partial<Record<NutrientKey, Provenance>>;
  portions: Portion[];
  defaultPortion: number;
  gradeCategory: GradeCategory;
  gradePortionGrams: number | null;
  ingredients: string[];
  allergens: string[];
  mayContain: string[];
  additives: string[];
  nova: number | null;
  items?: { name: string; grams: number; nutrients: Nutrients; provenance: Provenance }[];
  alternatives: FoodHit[];
  tip?: string;
  hints: string[];
  confidence: "high" | "medium" | "low";
  profile: { allergies: string[]; diet: Diet; goal: Goal; targets: DailyTargets };
  servingUnknown?: boolean;
}): ScanResult {
  const grade = gradeFood({
    gradeCategory: args.gradeCategory,
    per100: args.per100,
    gradePortionGrams: args.gradePortionGrams,
    additives: args.additives,
    nova: args.nova,
  });

  const portion = args.portions[args.defaultPortion] ?? args.portions[0] ?? FALLBACK_PORTION;
  const portionGrams = portion.grams ?? 100;
  const perPortion = nutrientsFor(args.per100, portionGrams);

  const reasons = explain({
    name: args.name,
    grade,
    per100: args.per100,
    basis: args.basis,
    perPortion,
    portionLabel: portion.label,
    targets: args.profile.targets,
  });

  const flags = personalise({
    name: args.name,
    allergens: toOffAllergenTags(args.allergens),
    ingredients: args.ingredients,
    mayContain: toOffAllergenTags(args.mayContain),
    perPortion,
    portionLabel: portion.label,
    profile: args.profile,
  });

  // Barcode hits are DB-complete by construction (§7.1 step 1) — always "high".
  const confidence = args.inputKind === "barcode" ? "high" : args.confidence;

  return {
    kind: args.kind,
    name: args.name,
    brand: args.brand,
    foodId: args.foodId,
    basis: args.basis,
    per100: args.per100,
    provenance: args.provenance,
    portions: args.portions,
    defaultPortion: args.defaultPortion,
    grade: grade.grade,
    gradeValue: grade.value,
    components: grade.components,
    reasons,
    flags,
    ingredients: args.ingredients,
    items: args.items,
    alternatives: args.alternatives,
    hints: args.hints,
    confidence,
    inputKind: args.inputKind,
    tip: args.tip,
    servingUnknown: args.servingUnknown,
  };
}
