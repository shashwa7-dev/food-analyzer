// Scan orchestration (spec §7.1 rev 4). Pure: every I/O step (DB lookups, Open Food Facts,
// the model call, the clock) comes in through EngineDeps, so this file imports nothing from
// next, drizzle-orm, lib/db or a network module — only types from those layers.
import { normaliseBarcode } from "./barcode";
import { toPer100, type ConvertedFacts } from "./convert";
import { EngineError } from "./errors";
import { mergeFacts } from "./merge";
import { buildResult, toOffAllergenTags, type ScanResult } from "./result";
import type { EngineImage, Extraction } from "./schema";
import { categoriesFromGuess, tipFor } from "./tips";
import { validateFacts } from "./validate";
import { classify } from "@/lib/nutrition/classify";
import { dishScore } from "@/lib/nutrition/grade/dish";
import { ensureBasePortion, nutrientsFor, scaleNutrients } from "@/lib/nutrition/portions";
import { NUTRIENT_KEYS, type DailyTargets, type Diet, type Goal, type Grade, type GradeResult, type NutrientKey, type Nutrients, type Portion, type Provenance } from "@/lib/nutrition/types";
import { normalise } from "@/lib/foods/normalise";
import { defaultPortionIndex, type SourceRecord } from "@/lib/foods/seed-map";
import type { FoodHit, FoodRow } from "@/lib/foods/types";

export const ENGINE_VERSION = "2026.10-m2";

export type FoodLike = Pick<
  FoodRow,
  | "id" | "name" | "brand" | "kind" | "gradeCategory" | "basis" | "per100" | "provenance" | "portions" | "defaultPortion"
  | "gradePortionGrams" | "ingredients" | "allergens" | "mayContain" | "additives" | "categories" | "nova" | "grade"
  | "gradeValue" | "gradeComponents" | "barcode"
>;

export interface ExtractOutput {
  data: Extraction;
  usage: { inputTokens: number; outputTokens: number };
  modelId: string;
  costMicros: number;
}

export interface EngineDeps {
  findFoodByBarcode(code: string): Promise<FoodLike | null>;
  fetchOffByBarcode(code: string): Promise<SourceRecord | null>;
  cacheOffFood(rec: SourceRecord): Promise<FoodLike>;
  /** Our DB only (never a runtime OFF search). */
  searchFoods(q: { name: string; brand?: string; country: string }): Promise<FoodLike[]>;
  alternatives(f: { categories: string[]; country: string; grade: Grade | null; excludeId?: string }): Promise<FoodHit[]>;
  /** Same shape as lib/engine/model.ts `extract`, so it can be passed in directly. */
  extract(images: EngineImage[], opts: { model: "fast" | "strong"; signal: AbortSignal; deadline: number }): Promise<ExtractOutput>;
  now(): number;
}

export interface EngineInput {
  barcode: string | null;
  images: EngineImage[];
  profile: { country: string; allergies: string[]; diet: Diet; goal: Goal; targets: DailyTargets };
}

export type EngineOutcome =
  | { kind: "barcode_done"; result: ScanResult; foodId: string } // free
  | { kind: "barcode_not_found" } // free, no images
  | { kind: "needs_ai"; barcodeFood: FoodLike | null }; // caller charges, then calls runAi

/** What lib/scans (Task 8) turns into a `crowd` FoodDraft. Never carries an image. */
export interface CrowdCandidate {
  name: string;
  brand: string | null;
  barcode: string | null;
  basis: "per_100g" | "per_100ml";
  per100: Nutrients;
  portions: Portion[];
  ingredients: string[];
  allergens: string[]; // OFF tags
  mayContain: string[]; // OFF tags
  additives: string[]; // OFF tags (en:e330, ...)
  categories: string[]; // OFF tags
}

export interface AiOutcome {
  result: ScanResult;
  crowdCandidate: CrowdCandidate | null;
  usage: { inputTokens: number; outputTokens: number };
  modelId: string;
  costMicros: number;
}

type Profile = EngineInput["profile"];

const HINT_RETAKE = "Some numbers look off — retake the label photo";
const HINT_NO_SERVING = "No serving size printed — log by grams";
const HINT_BACK = "Add a photo of the back for exact facts";
const NAME_MATCH_MIN = 0.8;
const FALLBACK_PRODUCT_NAME = "Packaged food";
const MAX_NAME = 120;
const REQUIRED_KEYS = ["energyKcal", "protein", "carbs", "fat"] as const;
const GRADES: readonly string[] = ["A", "B", "C", "D", "E"];

const unreadable = () => new EngineError("UNREADABLE_IMAGE", "Couldn't read the photo. Try again with the label in focus and well lit.");
const notFood = () => new EngineError("NOT_FOOD", "That doesn't look like food. Try a photo of the label or your plate.");

function hasCoreFacts(per100: Partial<Nutrients> | null | undefined): per100 is Nutrients {
  return !!per100 && REQUIRED_KEYS.every((k) => typeof per100[k] === "number" && Number.isFinite(per100[k]));
}

// --- Name matching (front of pack) ------------------------------------------------------------

const tokens = (s: string | null | undefined): string[] => (s ? normalise(s).split(" ").filter(Boolean) : []);

/**
 * Token Jaccard similarity of two product names after `normalise`. Tokens of any given brand are
 * dropped from both sides first ("Shree Rama Aloo Bhujia" vs "Aloo Bhujia" by Shree Rama → 1),
 * unless that would leave a name empty.
 */
export function nameSimilarity(a: string, b: string, ...brands: (string | null | undefined)[]): number {
  const brandTokens = new Set(brands.flatMap(tokens));
  const strip = (ts: string[]) => {
    const kept = ts.filter((t) => !brandTokens.has(t));
    return new Set(kept.length > 0 ? kept : ts);
  };
  const ta = strip(tokens(a));
  const tb = strip(tokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared);
}

/** Brands match when either is unknown, or one's tokens are all in the other's ("Shree Rama" ⊂ "Shree Rama Foods"). */
function brandsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const ta = tokens(a), tb = tokens(b);
  if (ta.length === 0 || tb.length === 0) return true;
  const [short, long] = ta.length <= tb.length ? [ta, new Set(tb)] : [tb, new Set(ta)];
  return short.every((t) => long.has(t));
}

async function matchByName(product: NonNullable<Extraction["product"]>, deps: EngineDeps, country: string): Promise<FoodLike | null> {
  const hits = await deps.searchFoods({ name: product.name, ...(product.brand && { brand: product.brand }), country });
  return (
    hits.find(
      (h) => hasCoreFacts(h.per100) && brandsMatch(product.brand, h.brand) && nameSimilarity(product.name, h.name, product.brand, h.brand) >= NAME_MATCH_MIN,
    ) ?? null
  );
}

// --- Tag mapping --------------------------------------------------------------------------------

/** Printed additive codes ("INS 330", "E621", "150d") → OFF tags ("en:e330"). Unrecognised entries are dropped. */
function toOffAdditiveTags(list: string[]): string[] {
  const out = new Set<string>();
  for (const raw of list) {
    const s = raw.trim().toLowerCase();
    if (/^en:e\d/.test(s)) {
      out.add(s);
      continue;
    }
    const m = s.match(/(?:^|[^a-z0-9])(?:e|ins)?\s*-?\s*(\d{3,4}[a-z]?)(?![0-9])/);
    if (m?.[1]) out.add(`en:e${m[1]}`);
  }
  return [...out];
}

const union = (...lists: string[][]): string[] => [...new Set(lists.flat())];

// --- Shared result helpers ------------------------------------------------------------------------

/** Alternatives (spec §7.4) for a packaged C–E result; a static category tip when none are found. */
async function withAlternatives(result: ScanResult, categories: string[], excludeId: string | null, deps: EngineDeps, country: string): Promise<ScanResult> {
  if (result.kind !== "packaged" || result.grade === null || result.grade === "A" || result.grade === "B") return result;
  const alternatives =
    categories.length > 0 ? await deps.alternatives({ categories, country, grade: result.grade, ...(excludeId && { excludeId }) }) : [];
  return alternatives.length > 0 ? { ...result, alternatives } : { ...result, alternatives, tip: tipFor(categories) };
}

function storedGrade(f: FoodLike): GradeResult {
  return { grade: f.grade && GRADES.includes(f.grade) ? (f.grade as Grade) : null, value: f.gradeValue, components: f.gradeComponents };
}

/** A result straight from a catalogue food (barcode hit, front-of-pack name match): its stored grade and per-field provenance. */
async function resultFromFood(
  f: FoodLike,
  inputKind: "barcode" | "front",
  confidence: "high" | "medium",
  hints: string[],
  profile: Profile,
  deps: EngineDeps,
): Promise<ScanResult> {
  const result = buildResult({
    name: f.name, brand: f.brand, foodId: f.id, kind: f.kind === "dish" ? "dish" : "packaged", inputKind,
    basis: f.basis, per100: f.per100, provenance: f.provenance, portions: f.portions, defaultPortion: f.defaultPortion,
    gradeCategory: f.gradeCategory, gradePortionGrams: f.gradePortionGrams,
    ingredients: f.ingredients, allergens: f.allergens, mayContain: f.mayContain, additives: f.additives, nova: f.nova,
    alternatives: [], hints, confidence, profile, precomputedGrade: storedGrade(f),
  });
  return withAlternatives(result, f.categories, f.id, deps, profile.country);
}

function packagedPortions(conv: { basis: "per_100g" | "per_100ml"; servingGrams: number | null; servingUnknown?: boolean }, packSize: { value: number } | undefined, extra: Portion[]): { portions: Portion[]; defaultPortion: number } {
  // Per-serving values with no printed size: the numbers ARE one serving, of unknown weight.
  if (conv.servingUnknown) return { portions: [{ label: "1 serving", amount: 1, unit: "serving", grams: null }], defaultPortion: 0 };
  const list: Portion[] = [];
  if (conv.servingGrams && conv.servingGrams > 0) list.push({ label: "1 serving", amount: 1, unit: "serving", grams: Math.round(conv.servingGrams) });
  if (packSize && packSize.value > 0) list.push({ label: "1 pack", amount: 1, unit: "pack", grams: Math.round(packSize.value) });
  const portions = ensureBasePortion(conv.basis, [...list, ...extra]);
  return { portions, defaultPortion: defaultPortionIndex(portions) };
}

/** Like toPer100, but for a panel missing some of energy/protein/carbs/fat: converts what's there (a DB match may fill the rest). */
function toPartialPer100(facts: Extraction["facts"]): (Omit<ConvertedFacts, "per100"> & { per100: Partial<Nutrients> }) | null {
  if (!facts) return null;
  const filled = toPer100({ ...facts, energyKcal: facts.energyKcal ?? 0, protein: facts.protein ?? 0, carbs: facts.carbs ?? 0, fat: facts.fat ?? 0 });
  if (!filled || filled.servingUnknown) return null; // unscaled per-serving values can't be mixed with a DB's per-100
  const per100: Partial<Nutrients> = { ...filled.per100 };
  for (const k of REQUIRED_KEYS) if (facts[k] === undefined) delete per100[k];
  return { ...filled, per100 };
}

// --- resolveBarcode (free) ------------------------------------------------------------------------

export async function resolveBarcode(input: EngineInput, deps: EngineDeps): Promise<EngineOutcome> {
  const hasImages = input.images.length > 0;
  const code = input.barcode ? normaliseBarcode(input.barcode) : null;
  if (!code) return input.barcode && !hasImages ? { kind: "barcode_not_found" } : { kind: "needs_ai", barcodeFood: null };

  let found = await deps.findFoodByBarcode(code);
  if (!found) {
    const rec = await deps.fetchOffByBarcode(code);
    if (rec) found = await deps.cacheOffFood(rec);
  }
  if (found && hasCoreFacts(found.per100)) {
    const result = await resultFromFood(found, "barcode", "high", [], input.profile, deps);
    return { kind: "barcode_done", result, foodId: found.id };
  }
  return hasImages ? { kind: "needs_ai", barcodeFood: found ?? null } : { kind: "barcode_not_found" };
}

// --- runAi (1 credit) -----------------------------------------------------------------------------

type Route = "label" | "meal" | "front" | "barcode";

function triage(x: Extraction): Route {
  const images = x.images;
  if (images.length > 0 && images.every((i) => i.kind === "not_food")) throw notFood();
  const usable = images.filter((i) => i.kind !== "not_food" && i.kind !== "unreadable");
  if (usable.length === 0) throw unreadable();
  if (images.every((i) => i.quality.length > 0) && !x.facts && !x.product && !x.meal) throw unreadable();
  const has = (k: Extraction["images"][number]["kind"]) => usable.some((i) => i.kind === k);
  if (has("nutrition_panel")) return "label";
  if (has("meal")) return "meal";
  if (has("front")) return "front";
  if (has("ingredients")) return "label"; // label without facts: needs a DB match by barcode or name
  return "barcode";
}

export async function runAi(input: EngineInput, deps: EngineDeps, deadline: number, barcodeFood: FoodLike | null = null): Promise<AiOutcome> {
  const signal = AbortSignal.timeout(Math.max(0, deadline - deps.now()));
  const { data: x, usage, modelId, costMicros } = await deps.extract(input.images, { model: "fast", signal, deadline });
  const meta = { usage, modelId, costMicros };
  const route = triage(x);

  // A submitted, valid barcode was already looked up by resolveBarcode (its food, if any, is
  // `barcodeFood`). Otherwise a barcode the model read off the photo gets one DB lookup — no OFF
  // call at this stage.
  const submitted = input.barcode ? normaliseBarcode(input.barcode) : null;
  const read = x.barcodeText ? normaliseBarcode(x.barcodeText) : null;
  const barcode = submitted ?? read;
  const lookupFood = async () => barcodeFood ?? (!submitted && read ? await deps.findFoodByBarcode(read) : null);

  switch (route) {
    case "barcode": {
      const dbFood = await lookupFood();
      if (!dbFood || !hasCoreFacts(dbFood.per100)) throw unreadable();
      return { result: await resultFromFood(dbFood, "barcode", "high", [], input.profile, deps), crowdCandidate: null, ...meta };
    }
    case "front":
      return { ...(await frontScan(x, input.profile, deps)), ...meta };
    case "meal":
      return { result: await mealScan(x, input.profile, deps), crowdCandidate: null, ...meta };
    case "label":
      return { ...(await labelScan(x, input.profile, deps, await lookupFood(), barcode)), ...meta };
  }
}

// --- label ------------------------------------------------------------------------------------------

async function labelScan(
  x: Extraction,
  profile: Profile,
  deps: EngineDeps,
  barcodeFood: FoodLike | null,
  barcode: string | null,
): Promise<{ result: ScanResult; crowdCandidate: CrowdCandidate | null }> {
  const complete = toPer100(x.facts);
  const servingUnknown = complete?.servingUnknown === true;
  const partial = complete ? null : toPartialPer100(x.facts);
  const conv = complete ?? partial;

  let db = servingUnknown ? null : barcodeFood;
  if (!complete && !db && x.product?.name) db = await matchByName(x.product, deps, profile.country);

  const merged = mergeFacts(conv?.per100 ?? null, db ? { per100: db.per100, provenance: db.provenance } : null);
  if (!merged) throw unreadable();

  const validation = conv ? validateFacts(merged.per100, { energyKj: conv.energyKj, saltG: conv.saltG }) : { ok: true, failed: [] };
  const hints: string[] = [];
  if (!validation.ok) hints.push(HINT_RETAKE);
  if (servingUnknown) hints.push(HINT_NO_SERVING);
  // high: a complete printed panel passing every check; medium: facts completed by a DB match.
  const confidence = !validation.ok || servingUnknown ? "low" : complete ? "high" : "medium";

  const basis = conv?.basis ?? db?.basis ?? "per_100g";
  const { portions, defaultPortion } = packagedPortions(
    { basis, servingGrams: conv?.servingGrams ?? null, servingUnknown },
    x.product?.packSize,
    db?.portions ?? [],
  );
  const guessed = categoriesFromGuess(x.product?.categoryGuess);
  const categories = db && db.categories.length > 0 ? db.categories : guessed;
  const name = (x.product?.name || db?.name || FALLBACK_PRODUCT_NAME).slice(0, MAX_NAME);
  const brand = x.product?.brand || db?.brand || null;
  const ingredients = x.ingredients ?? db?.ingredients ?? [];
  const allergens = union(toOffAllergenTags(x.allergensDeclared ?? []), toOffAllergenTags(db?.allergens ?? []));
  const mayContain = union(toOffAllergenTags(x.mayContain ?? []), toOffAllergenTags(db?.mayContain ?? []));
  const additives = union(toOffAdditiveTags(x.additives ?? []), db?.additives ?? []);
  const { gradeCategory } = classify({ source: "crowd", name, categories, per100: merged.per100 });

  const built = buildResult({
    name, brand, foodId: null, kind: "packaged", inputKind: "label", basis, per100: merged.per100, provenance: merged.provenance,
    portions, defaultPortion, gradeCategory, gradePortionGrams: null, ingredients, allergens, mayContain, additives,
    nova: db?.nova ?? null, alternatives: [], hints, confidence, profile, ...(servingUnknown && { servingUnknown }),
  });
  const result = await withAlternatives(built, categories, db?.id ?? null, deps, profile.country);

  const crowdCandidate: CrowdCandidate | null =
    confidence === "high" && x.product?.name
      ? { name, brand, barcode, basis, per100: merged.per100, portions, ingredients, allergens, mayContain, additives, categories }
      : null;
  return { result, crowdCandidate };
}

// --- front of pack ---------------------------------------------------------------------------------

async function frontScan(x: Extraction, profile: Profile, deps: EngineDeps): Promise<{ result: ScanResult; crowdCandidate: null }> {
  const match = x.product?.name ? await matchByName(x.product, deps, profile.country) : null;
  if (match) return { result: await resultFromFood(match, "front", "medium", [HINT_BACK], profile, deps), crowdCandidate: null };

  const est = toPer100(x.facts);
  if (!est) throw unreadable();
  const provenance: Partial<Record<NutrientKey, Provenance>> = Object.fromEntries(
    NUTRIENT_KEYS.filter((k) => est.per100[k] !== undefined).map((k) => [k, "estimate" as const]),
  );
  const categories = categoriesFromGuess(x.product?.categoryGuess);
  const name = (x.product?.name || FALLBACK_PRODUCT_NAME).slice(0, MAX_NAME);
  const { gradeCategory } = classify({ source: "crowd", name, categories, per100: est.per100 });
  const { portions, defaultPortion } = packagedPortions(est, x.product?.packSize, []);
  const built = buildResult({
    name, brand: x.product?.brand || null, foodId: null, kind: "packaged", inputKind: "front", basis: est.basis, per100: est.per100, provenance,
    portions, defaultPortion, gradeCategory, gradePortionGrams: null, ingredients: x.ingredients ?? [],
    allergens: toOffAllergenTags(x.allergensDeclared ?? []), mayContain: toOffAllergenTags(x.mayContain ?? []),
    additives: toOffAdditiveTags(x.additives ?? []), nova: null, alternatives: [],
    hints: est.servingUnknown ? [HINT_BACK, HINT_NO_SERVING] : [HINT_BACK], confidence: "low", profile,
    ...(est.servingUnknown && { servingUnknown: true }),
  });
  return { result: await withAlternatives(built, categories, null, deps, profile.country), crowdCandidate: null };
}

// --- meal ------------------------------------------------------------------------------------------

type MealItem = NonNullable<ScanResult["items"]>[number];

function cleanNutrients(n: Partial<Record<NutrientKey, number | undefined>>): Nutrients {
  const out: Partial<Nutrients> = {};
  for (const k of NUTRIENT_KEYS) {
    const v = n[k];
    if (typeof v === "number") out[k] = v;
  }
  return out as Nutrients;
}

/** Sum of items; an optional nutrient is included only when every item has it (a partial sum would understate it). */
function sumItems(items: MealItem[]): Nutrients {
  const out: Partial<Nutrients> = {};
  for (const k of NUTRIENT_KEYS) {
    if (!items.every((it) => typeof it.nutrients[k] === "number")) continue;
    out[k] = Math.round(items.reduce((s, it) => s + (it.nutrients[k] ?? 0), 0) * 1000) / 1000;
  }
  return out as Nutrients;
}

function mealName(items: MealItem[]): string {
  const names = items.map((it) => it.name.trim()).filter(Boolean);
  const joined = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? "Meal");
  const s = joined.charAt(0).toUpperCase() + joined.slice(1);
  return s.length > MAX_NAME ? `${s.slice(0, MAX_NAME - 1)}…` : s;
}

async function mealScan(x: Extraction, profile: Profile, deps: EngineDeps): Promise<ScanResult> {
  const raw = x.meal?.items ?? [];
  if (raw.length === 0) throw unreadable();

  const items: MealItem[] = await Promise.all(
    raw.map(async (it): Promise<MealItem> => {
      const hits = await deps.searchFoods({ name: it.name, country: profile.country });
      const hit = hits.find((h) => h.kind !== "ingredient" && hasCoreFacts(h.per100));
      return hit
        ? { name: it.name, grams: it.grams, nutrients: nutrientsFor(hit.per100, it.grams), provenance: "reference" }
        : { name: it.name, grams: it.grams, nutrients: cleanNutrients(it.estimate), provenance: "estimate" };
    }),
  );

  const total = sumItems(items);
  const grams = items.reduce((s, it) => s + it.grams, 0);
  const per100 = scaleNutrients(total, 100 / grams);
  const anyEstimate = items.some((it) => it.provenance === "estimate");
  const provenance: Partial<Record<NutrientKey, Provenance>> = Object.fromEntries(
    NUTRIENT_KEYS.filter((k) => total[k] !== undefined).map((k) => [k, anyEstimate ? "estimate" : "reference"]),
  );
  const portions = ensureBasePortion("per_100g", [{ label: "This meal", amount: 1, unit: "serving", grams: Math.round(grams) }]);

  return buildResult({
    name: mealName(items), brand: null, foodId: null, kind: "meal", inputKind: "meal", basis: "per_100g", per100, provenance,
    portions, defaultPortion: 0, gradeCategory: "dish", gradePortionGrams: Math.round(grams),
    ingredients: [], allergens: [], mayContain: [], additives: [], nova: null, items, alternatives: [], hints: [],
    confidence: anyEstimate ? "low" : "medium", profile, precomputedGrade: dishScore(total, per100),
  });
}
