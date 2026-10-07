import { gradeFood } from "@/lib/nutrition/grade";
import { explain } from "@/lib/nutrition/explain";
import { OFF_TAG, personalise } from "@/lib/nutrition/personalise";
import { nutrientsFor } from "@/lib/nutrition/portions";
import type { DailyTargets, Diet, Flag, Goal, Grade, GradeCategory, GradeResult, NutrientKey, Nutrients, Portion, Provenance, Reason, ScoreComponent } from "@/lib/nutrition/types";
import type { FoodHit } from "@/lib/foods/types";

export interface ScanResult {
  kind: "packaged" | "dish" | "meal";
  name: string;
  brand: string | null;
  foodId: string | null;
  basis: "per_100g" | "per_100ml";
  /**
   * Per-100 g/ml values. Null when the label gave per-serving values without a serving weight
   * (`servingUnknown`): there is no honest per-100 figure, so the values live in `perServing`, the
   * result is ungraded and can only be logged by servings (never by grams, never saved as a food).
   */
  per100: Nutrients | null;
  perServing?: Nutrients;
  provenance: Partial<Record<NutrientKey, Provenance>>;
  portions: Portion[];
  defaultPortion: number;
  grade: Grade | null;
  gradeValue: number | null;
  components: ScoreComponent[];
  reasons: Reason[];
  flags: Flag[];
  ingredients: string[];
  /** Declared allergens, may-contain traces and additives as OFF tags (en:milk, en:e330). Missing on scans stored before M2's fix wave. */
  allergens?: string[];
  mayContain?: string[];
  additives?: string[];
  items?: { name: string; grams: number; foodId?: string; nutrients: Nutrients; provenance: Provenance }[];
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

// Idempotent: values that are already recognised OFF tags (catalogue foods store allergens as
// OFF tags) pass through unchanged, so a list can safely go through this more than once — the
// engine converts extraction allergens before buildResult, and buildResult converts again.
export function toOffAllergenTags(keys: string[]): string[] {
  const out = new Set<string>();
  for (const key of keys) {
    const tag = key in OFF_TAG ? key : ALLERGEN_KEY_TO_OFF_TAG[key];
    if (typeof tag === "string") out.add(tag);
  }
  return [...out];
}

export const isOffTag = (t: string) => /^[a-z]{2}:/.test(t);
const union = (...lists: string[][]): string[] => [...new Set(lists.flat())];

const NOT_GRADED = "Not graded: the label gives values per serving but no serving weight, so we can't compare it per 100 g.";

const FALLBACK_PORTION: Portion = { label: "100 g", amount: 100, unit: "g", grams: 100 };

export function buildResult(args: {
  name: string;
  brand: string | null;
  foodId: string | null;
  kind: "packaged" | "dish" | "meal";
  inputKind: "barcode" | "label" | "front" | "meal";
  basis: "per_100g" | "per_100ml";
  /** Null with `perServing` set: one serving's values of unknown weight (see ScanResult.per100). */
  per100: Nutrients | null;
  perServing?: Nutrients;
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
  items?: { name: string; grams: number; foodId?: string; nutrients: Nutrients; provenance: Provenance }[];
  alternatives: FoodHit[];
  tip?: string;
  hints: string[];
  confidence: "high" | "medium" | "low";
  profile: { allergies: string[]; diet: Diet; goal: Goal; targets: DailyTargets };
  servingUnknown?: boolean;
  /** Use this grade instead of recomputing: a catalogue food's stored grade (grades shown are the stored neutral grade), or a meal's dishScore on its exact total. */
  precomputedGrade?: GradeResult;
}): ScanResult {
  const per100 = args.per100;
  const perServing = per100 ? undefined : args.perServing;
  if (!per100 && !perServing) throw new Error("buildResult needs per100 or perServing");
  // Unknown serving weight: nothing per-100 to grade on, so the result is ungraded.
  const grade: GradeResult = !per100 ? { grade: null, value: null, components: [] } : args.precomputedGrade ?? gradeFood({
    gradeCategory: args.gradeCategory,
    per100,
    gradePortionGrams: args.gradePortionGrams,
    additives: args.additives,
    nova: args.nova,
  });

  const portion = args.portions[args.defaultPortion] ?? args.portions[0] ?? FALLBACK_PORTION;
  const portionGrams = portion.grams && portion.grams > 0 ? portion.grams : 100;
  const perPortion = per100 ? nutrientsFor(per100, portionGrams) : perServing!;

  const reasons: Reason[] = per100
    ? explain({ name: args.name, grade, per100, basis: args.basis, perPortion, portionLabel: portion.label, targets: args.profile.targets })
    : [{ tone: "warn", text: NOT_GRADED }];

  // Model keys become OFF tags; tags we don't map (en:celery, ...) are kept so a saved food carries them too.
  const allergens = union(toOffAllergenTags(args.allergens), args.allergens.filter(isOffTag));
  const mayContain = union(toOffAllergenTags(args.mayContain), args.mayContain.filter(isOffTag));
  const flags = personalise({
    name: args.name,
    allergens,
    ingredients: args.ingredients,
    mayContain,
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
    per100,
    ...(perServing && { perServing }),
    provenance: args.provenance,
    portions: args.portions,
    defaultPortion: args.defaultPortion,
    grade: grade.grade,
    gradeValue: grade.value,
    components: grade.components,
    reasons,
    flags,
    ingredients: args.ingredients,
    allergens,
    mayContain,
    additives: args.additives,
    items: args.items,
    alternatives: args.alternatives,
    hints: args.hints,
    confidence,
    inputKind: args.inputKind,
    tip: args.tip,
    servingUnknown: per100 ? args.servingUnknown : true,
  };
}
