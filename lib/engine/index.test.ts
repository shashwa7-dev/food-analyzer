import { describe, expect, it, vi } from "vitest";
import { ENGINE_VERSION, nameSimilarity, resolveBarcode, runAi, type EngineDeps, type EngineInput, type FoodLike } from "./index";
import { EngineError } from "./errors";
import { sanitiseExtraction, type EngineImage, type Extraction } from "./schema";
import { PRESETS } from "@/lib/nutrition/targets";
import type { FoodHit } from "@/lib/foods/types";
import type { SourceRecord } from "@/lib/foods/seed-map";
import labelNamkeenJson from "./__fixtures__/label-namkeen.json";
import labelBeverageJson from "./__fixtures__/label-beverage.json";
import perServingJson from "./__fixtures__/label-per-serving-no-size.json";
import frontOnlyJson from "./__fixtures__/front-only.json";
import mealThaliJson from "./__fixtures__/meal-thali.json";
import notFoodJson from "./__fixtures__/not-food.json";
import unreadableJson from "./__fixtures__/unreadable.json";

// Fixtures go through the same sanitiser as real model output.
const fx = (json: unknown): Extraction => sanitiseExtraction(json);
const labelNamkeen = fx(labelNamkeenJson);
const labelBeverage = fx(labelBeverageJson);
const perServing = fx(perServingJson);
const frontOnly = fx(frontOnlyJson);
const mealThali = fx(mealThaliJson);
const notFood = fx(notFoodJson);
const unreadable = fx(unreadableJson);

const IMG: EngineImage = { mime: "image/jpeg", data: new Uint8Array([0xff, 0xd8, 0xff]) };
const NAMKEEN_CODE = "8901491101837";
const NOW = 1_800_000_000_000;
const DEADLINE = NOW + 50_000;

function food(overrides: Partial<FoodLike> = {}): FoodLike {
  return {
    id: "f-bhujia", name: "Aloo Bhujia", brand: "Shree Rama", kind: "packaged", gradeCategory: "general", basis: "per_100g",
    per100: { energyKcal: 554, protein: 11, carbs: 51.7, fat: 34, sugars: 2, satFat: 15, fibre: 4, sodiumMg: 1050 },
    provenance: { energyKcal: "community", protein: "community", carbs: "community", fat: "community", sugars: "community", satFat: "community", fibre: "community", sodiumMg: "community" },
    portions: [{ label: "1 serving", amount: 1, unit: "serving", grams: 30 }, { label: "100 g", amount: 100, unit: "g", grams: 100 }],
    defaultPortion: 0, gradePortionGrams: null,
    ingredients: ["gram flour", "palmolein", "salt"], allergens: ["en:peanuts"], mayContain: ["en:milk"], additives: ["en:e330"],
    categories: ["en:snacks", "en:salty-snacks"], nova: 4, grade: "E", gradeValue: 12, gradeComponents: [], barcode: NAMKEEN_CODE,
    ...overrides,
  };
}

const HIT: FoodHit = { id: "f-chana", name: "Roasted Chana", brand: "Healthy Co", kind: "packaged", grade: "B", source: "off", defaultPortion: { label: "1 serving", grams: 30, kcal: 110 } };

const OFF_REC: SourceRecord = {
  source: "off", sourceRef: NAMKEEN_CODE, barcode: NAMKEEN_CODE, name: "Aloo Bhujia", brand: "Shree Rama", basis: "per_100g",
  per100: food().per100, portions: [], categories: ["en:snacks"], countries: ["IN"],
};

function extractReturning(data: Extraction): EngineDeps["extract"] {
  return vi.fn(async () => ({ data, usage: { inputTokens: 1200, outputTokens: 300 }, modelId: "gemini-3.5-flash-lite", costMicros: 1110 }));
}

function deps(overrides: Partial<EngineDeps> = {}): EngineDeps {
  return {
    findFoodByBarcode: vi.fn(async () => null),
    lookupOffByBarcode: vi.fn(async () => ({ status: "not_found" as const })),
    cacheOffFood: vi.fn(async () => food()),
    searchFoods: vi.fn(async () => []),
    alternatives: vi.fn(async () => []),
    extract: vi.fn(async () => { throw new Error("extract must not be called"); }),
    now: () => NOW,
    ...overrides,
  };
}

function input(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    barcode: null, images: [IMG],
    profile: { country: "IN", allergies: [], diet: "none", goal: "general", targets: PRESETS.general },
    ...overrides,
  };
}

async function engineError(p: Promise<unknown>): Promise<EngineError> {
  try {
    await p;
  } catch (err) {
    if (err instanceof EngineError) return err;
    throw err;
  }
  throw new Error("expected an EngineError");
}

it("exports the engine version", () => {
  expect(ENGINE_VERSION).toBe("2026.10-m2");
});

describe("nameSimilarity", () => {
  it("is token Jaccard over normalised names", () => {
    expect(nameSimilarity("Aloo Bhujia", "aloo  bhujia!")).toBe(1);
    expect(nameSimilarity("Aloo Bhujia", "Aloo Bhujia Masala")).toBeCloseTo(2 / 3);
    expect(nameSimilarity("", "Aloo")).toBe(0);
  });
  it("ignores brand tokens on either side", () => {
    expect(nameSimilarity("Shree Rama Aloo Bhujia", "Aloo Bhujia", "Shree Rama")).toBe(1);
  });
});

describe("resolveBarcode", () => {
  it("barcode hit in our DB → barcode_done, free (extract never called), photos ignored", async () => {
    const d = deps({ findFoodByBarcode: vi.fn(async () => food()), alternatives: vi.fn(async () => [HIT]) });
    const out = await resolveBarcode(input({ barcode: NAMKEEN_CODE, images: [IMG] }), d);
    expect(out.kind).toBe("barcode_done");
    if (out.kind !== "barcode_done") return;
    expect(out.foodId).toBe("f-bhujia");
    expect(out.result).toMatchObject({ inputKind: "barcode", confidence: "high", foodId: "f-bhujia", kind: "packaged", name: "Aloo Bhujia" });
    expect(out.result.grade).toBe("E"); // stored grade
    expect(out.result.alternatives).toEqual([HIT]);
    expect(d.extract).not.toHaveBeenCalled();
    expect(d.lookupOffByBarcode).not.toHaveBeenCalled();
    expect(d.alternatives).toHaveBeenCalledWith({ categories: ["en:snacks", "en:salty-snacks"], country: "IN", grade: "E", excludeId: "f-bhujia" });
  });

  it("flags catalogue allergens (OFF tags) for an allergic profile", async () => {
    const d = deps({ findFoodByBarcode: vi.fn(async () => food()) });
    const out = await resolveBarcode(input({ barcode: NAMKEEN_CODE, profile: { country: "IN", allergies: ["peanut", "milk"], diet: "none", goal: "general", targets: PRESETS.general } }), d);
    if (out.kind !== "barcode_done") throw new Error("expected barcode_done");
    expect(out.result.flags.find((f) => f.key === "peanut")?.severity).toBe("contains");
    expect(out.result.flags.find((f) => f.key === "milk")?.severity).toBe("may_contain");
  });

  it("DB miss → OFF lookup → cached → barcode_done", async () => {
    const d = deps({ lookupOffByBarcode: vi.fn(async () => ({ status: "found" as const, rec: OFF_REC })), cacheOffFood: vi.fn(async () => food({ id: "f-off" })) });
    const out = await resolveBarcode(input({ barcode: NAMKEEN_CODE, images: [] }), d);
    expect(out).toMatchObject({ kind: "barcode_done", foodId: "f-off" });
    expect(d.lookupOffByBarcode).toHaveBeenCalledWith(NAMKEEN_CODE);
    expect(d.cacheOffFood).toHaveBeenCalledWith(OFF_REC);
  });

  it("sets a static category tip when a C–E food has no alternatives", async () => {
    const d = deps({ findFoodByBarcode: vi.fn(async () => food()) });
    const out = await resolveBarcode(input({ barcode: NAMKEEN_CODE }), d);
    if (out.kind !== "barcode_done") throw new Error("expected barcode_done");
    expect(out.result.alternatives).toEqual([]);
    expect(out.result.tip).toBe("Roasted chana or makhana are lower in fat and sodium.");
  });

  it("skips alternatives for an A/B food", async () => {
    const d = deps({ findFoodByBarcode: vi.fn(async () => food({ grade: "B", gradeValue: 70 })) });
    const out = await resolveBarcode(input({ barcode: NAMKEEN_CODE }), d);
    if (out.kind !== "barcode_done") throw new Error("expected barcode_done");
    expect(d.alternatives).not.toHaveBeenCalled();
    expect(out.result.tip).toBeUndefined();
  });

  it("barcode miss + no images → barcode_not_found", async () => {
    const d = deps();
    expect(await resolveBarcode(input({ barcode: NAMKEEN_CODE, images: [] }), d)).toEqual({ kind: "barcode_not_found" });
    expect(d.extract).not.toHaveBeenCalled();
  });

  it("barcode miss + images → needs_ai with no barcode food", async () => {
    const d = deps();
    expect(await resolveBarcode(input({ barcode: NAMKEEN_CODE, images: [IMG] }), d)).toEqual({ kind: "needs_ai", barcodeFood: null, offNotFound: true });
    expect(d.extract).not.toHaveBeenCalled();
  });

  it("incomplete DB hit + images → needs_ai carrying the food for merge", async () => {
    const partial = food({ per100: { energyKcal: 554, protein: 11, carbs: 51.7 } as FoodLike["per100"] });
    const d = deps({ findFoodByBarcode: vi.fn(async () => partial) });
    expect(await resolveBarcode(input({ barcode: NAMKEEN_CODE, images: [IMG] }), d)).toEqual({ kind: "needs_ai", barcodeFood: partial, offNotFound: false });
  });

  it("invalid barcode is never looked up", async () => {
    const d = deps();
    expect(await resolveBarcode(input({ barcode: "1234567890123", images: [] }), d)).toEqual({ kind: "barcode_not_found" });
    expect(d.findFoodByBarcode).not.toHaveBeenCalled();
    expect(d.lookupOffByBarcode).not.toHaveBeenCalled();
  });

  it("OFF timed out or down → needs_ai without offNotFound (no evidence OFF lacks the product)", async () => {
    const d = deps({ lookupOffByBarcode: vi.fn(async () => ({ status: "unavailable" as const })) });
    expect(await resolveBarcode(input({ barcode: NAMKEEN_CODE, images: [IMG] }), d)).toEqual({ kind: "needs_ai", barcodeFood: null, offNotFound: false });
  });

  it("no barcode → needs_ai", async () => {
    const d = deps();
    expect(await resolveBarcode(input({ barcode: null }), d)).toEqual({ kind: "needs_ai", barcodeFood: null, offNotFound: false });
    expect(d.findFoodByBarcode).not.toHaveBeenCalled();
  });
});

describe("runAi — label", () => {
  it("happy path: high confidence, label provenance, crowd candidate present", async () => {
    const d = deps({ extract: extractReturning(labelNamkeen), findFoodByBarcode: vi.fn(async () => null) });
    const out = await runAi(input({ profile: { country: "IN", allergies: ["peanut"], diet: "none", goal: "general", targets: PRESETS.general } }), d, DEADLINE, null);
    expect(d.extract).toHaveBeenCalledTimes(1);
    const [, opts] = vi.mocked(d.extract).mock.calls[0]!;
    expect(opts).toMatchObject({ model: "fast", deadline: DEADLINE });
    expect(opts.signal).toBeInstanceOf(AbortSignal);
    expect(out.result).toMatchObject({ inputKind: "label", kind: "packaged", confidence: "high", name: "Aloo Bhujia", brand: "Shree Rama", basis: "per_100g", foodId: null });
    expect(out.result.hints).toEqual([]);
    expect(out.result.per100!.energyKcal).toBe(554);
    expect(out.result.provenance.energyKcal).toBe("label");
    expect(out.result.portions.map((p) => p.label)).toEqual(["1 serving", "1 pack", "100 g"]);
    expect(out.result.portions[out.result.defaultPortion]?.label).toBe("1 serving");
    expect(out.result.grade).not.toBeNull();
    // mayContain keys → OFF tags → may_contain flag
    expect(out.result.flags.find((f) => f.key === "peanut")?.severity).toBe("may_contain");
    expect(out.usage).toEqual({ inputTokens: 1200, outputTokens: 300 });
    expect(out.modelId).toBe("gemini-3.5-flash-lite");
    expect(out.costMicros).toBe(1110);
    expect(out.crowdCandidate).toMatchObject({
      name: "Aloo Bhujia", brand: "Shree Rama", barcode: NAMKEEN_CODE, basis: "per_100g",
      categories: ["en:snacks", "en:salty-snacks"], mayContain: ["en:peanuts", "en:nuts", "en:milk"], allergens: [], additives: ["en:e330"],
    });
    expect(out.crowdCandidate?.per100.energyKcal).toBe(554);
    expect(out.crowdCandidate?.ingredients[0]).toBe("Gram flour (besan)");
    expect(JSON.stringify(out.crowdCandidate)).not.toMatch(/imageUrl|thumbnail/);
  });

  it("looks up barcodeText once (no OFF call on a DB hit) when no barcode was submitted, and merges DB gaps", async () => {
    const dbFood = food({ per100: { energyKcal: 550, protein: 10, carbs: 50, fat: 33, fibre: 4, sugars: 2, satFat: 15, sodiumMg: 1000, transFat: 0.2 }, provenance: { ...food().provenance, transFat: "community" } });
    const noTrans = { ...labelNamkeen, facts: { ...labelNamkeen.facts!, transFat: undefined } };
    const d = deps({ extract: extractReturning(noTrans), findFoodByBarcode: vi.fn(async () => dbFood) });
    const out = await runAi(input(), d, DEADLINE, null);
    expect(d.findFoodByBarcode).toHaveBeenCalledTimes(1);
    expect(d.findFoodByBarcode).toHaveBeenCalledWith(NAMKEEN_CODE);
    expect(d.lookupOffByBarcode).not.toHaveBeenCalled();
    expect(out.result.per100!.energyKcal).toBe(554);
    expect(out.result.provenance.energyKcal).toBe("label");
    expect(out.result.per100!.transFat).toBe(0.2);
    expect(out.result.provenance.transFat).toBe("community");
  });

  it("uses the barcode food handed over by resolveBarcode and doesn't look it up again", async () => {
    const d = deps({ extract: extractReturning(labelNamkeen) });
    await runAi(input({ barcode: NAMKEEN_CODE }), d, DEADLINE, food());
    expect(d.findFoodByBarcode).not.toHaveBeenCalled();
  });

  it("failing validation: low confidence, retake hint, no crowd candidate", async () => {
    // Decimal misread: 254 kcal printed as-read against 556 kcal of macros.
    const misread = { ...labelNamkeen, facts: { ...labelNamkeen.facts!, energyKcal: 254, energyKj: undefined } };
    const d = deps({ extract: extractReturning(misread) });
    const out = await runAi(input(), d, DEADLINE, null);
    expect(out.result.confidence).toBe("low");
    expect(out.result.hints).toContain("Some numbers look off — retake the label photo");
    expect(out.result.per100!.energyKcal).toBe(254); // values kept
    expect(out.crowdCandidate).toBeNull();
  });

  it("per-serving without a serving size: low confidence, servings-only hint, servingUnknown, no crowd candidate", async () => {
    const d = deps({ extract: extractReturning(perServing) });
    const out = await runAi(input(), d, DEADLINE, null);
    expect(out.result.confidence).toBe("low");
    expect(out.result.hints).toContain("No serving weight printed — log it by servings, not grams");
    expect(out.result.servingUnknown).toBe(true);
    expect(out.result.portions).toEqual([{ label: "1 serving", amount: 1, unit: "serving", grams: null }]);
    expect(out.crowdCandidate).toBeNull();
  });

  it("per-serving without a serving size never stores the per-serving numbers as per-100, and is ungraded", async () => {
    const out = await runAi(input(), deps({ extract: extractReturning(perServing) }), DEADLINE, null);
    expect(out.result.per100).toBeNull();
    expect(out.result.perServing).toMatchObject({ energyKcal: 160, sodiumMg: 420, protein: 4.4 });
    expect(out.result.grade).toBeNull();
    expect(out.result.gradeValue).toBeNull();
    expect(out.result.reasons[0]!.text).toMatch(/no serving weight/);
    // Goal flags read the one serving as printed (420 mg is 21% of a 2000 mg limit).
    expect(out.result.flags.find((f) => f.key === "sodium")?.text).toBe("1 serving uses 21% of your daily sodium limit.");
  });

  it("beverage label: per_100ml, beverage categories, alternatives requested for a C–E grade", async () => {
    const d = deps({ extract: extractReturning(labelBeverage), alternatives: vi.fn(async () => [HIT]) });
    const out = await runAi(input(), d, DEADLINE, null);
    expect(out.result.basis).toBe("per_100ml");
    expect(out.result.portions.map((p) => p.label)).toEqual(["1 serving", "1 pack", "100 ml"]);
    expect(out.crowdCandidate?.categories).toEqual(["en:beverages", "en:sodas"]);
    expect(out.crowdCandidate?.additives).toEqual(["en:e150d", "en:e338", "en:e211"]);
    expect(["C", "D", "E"]).toContain(out.result.grade);
    expect(d.alternatives).toHaveBeenCalledWith({ categories: ["en:beverages", "en:sodas"], country: "IN", grade: out.result.grade });
    expect(out.result.alternatives).toEqual([HIT]);
  });

  it("captures every additive code in one entry", async () => {
    const multi = { ...labelNamkeen, additives: ["Emulsifiers (INS 322, INS 471)", "E621"] };
    const out = await runAi(input(), deps({ extract: extractReturning(multi) }), DEADLINE, null);
    expect(out.crowdCandidate?.additives).toEqual(["en:e322", "en:e471", "en:e621"]);
  });

  it("ingredients-only with no DB match → UNREADABLE_IMAGE", async () => {
    const ingOnly: Extraction = { images: [{ index: 0, kind: "ingredients", quality: [] }], ingredients: ["Sugar", "Cocoa"] };
    const err = await engineError(runAi(input(), deps({ extract: extractReturning(ingOnly) }), DEADLINE, null));
    expect(err.code).toBe("UNREADABLE_IMAGE");
  });

  it("ingredients-only with a barcode DB match uses the DB facts (medium) and the printed ingredients", async () => {
    const ingOnly: Extraction = { images: [{ index: 0, kind: "ingredients", quality: [] }], ingredients: ["Gram flour", "Groundnut oil"], allergensDeclared: ["peanut"] };
    const out = await runAi(input({ barcode: NAMKEEN_CODE }), deps({ extract: extractReturning(ingOnly) }), DEADLINE, food({ per100: { energyKcal: 554, protein: 11, carbs: 51.7, fat: 34 } }));
    expect(out.result.confidence).toBe("medium");
    expect(out.result.per100!.energyKcal).toBe(554);
    expect(out.result.ingredients).toEqual(["Gram flour", "Groundnut oil"]);
    expect(out.crowdCandidate).toBeNull();
  });
});

describe("runAi — front of pack", () => {
  it("matched by name + brand → catalogue food, medium confidence, back-photo hint", async () => {
    const d = deps({ extract: extractReturning(frontOnly), searchFoods: vi.fn(async () => [food({ id: "f-other", name: "Aloo Bhujia Masala Mix", brand: "Shree Rama" }), food()]) });
    const out = await runAi(input(), d, DEADLINE, null);
    expect(d.searchFoods).toHaveBeenCalledWith({ name: "Shree Rama Aloo Bhujia", brand: "Shree Rama", country: "IN" });
    expect(out.result).toMatchObject({ inputKind: "front", confidence: "medium", foodId: "f-bhujia", name: "Aloo Bhujia", grade: "E" });
    expect(out.result.hints).toEqual(["Add a photo of the back for exact facts"]);
    expect(out.result.provenance.energyKcal).toBe("community");
    expect(out.crowdCandidate).toBeNull();
  });

  it("rejects a name match whose brand differs", async () => {
    const d = deps({ extract: extractReturning(frontOnly), searchFoods: vi.fn(async () => [food({ brand: "Other Brand" })]) });
    expect((await engineError(runAi(input(), d, DEADLINE, null))).code).toBe("UNREADABLE_IMAGE");
  });

  it("unmatched with no facts → UNREADABLE_IMAGE with the unknown-product message", async () => {
    const d = deps({ extract: extractReturning(frontOnly) });
    const err = await engineError(runAi(input(), d, DEADLINE, null));
    expect(err.code).toBe("UNREADABLE_IMAGE");
    expect(err.message).toBe("We don't know this product yet — add a photo of the nutrition label.");
  });

  it("with a brand, only matches packaged foods (never dishes or ingredients)", async () => {
    const d = deps({ extract: extractReturning(frontOnly), searchFoods: vi.fn(async () => [food({ kind: "dish" }), food({ kind: "ingredient" })]) });
    expect((await engineError(runAi(input(), d, DEADLINE, null))).code).toBe("UNREADABLE_IMAGE");
  });

  it("without a brand, still never matches an ingredient", async () => {
    const noBrand = { ...frontOnly, product: { name: "Aloo Bhujia" } };
    const d = deps({ extract: extractReturning(noBrand), searchFoods: vi.fn(async () => [food({ kind: "ingredient", brand: null })]) });
    expect((await engineError(runAi(input(), d, DEADLINE, null))).code).toBe("UNREADABLE_IMAGE");
  });

  it("unmatched with estimated facts → estimate provenance, low confidence, back-photo hint", async () => {
    const withFacts = { ...frontOnly, facts: { basis: "per_100g" as const, energyKcal: 550, protein: 11, carbs: 52, fat: 33 } };
    const out = await runAi(input(), deps({ extract: extractReturning(withFacts) }), DEADLINE, null);
    expect(out.result).toMatchObject({ inputKind: "front", confidence: "low", foodId: null });
    expect(out.result.provenance).toEqual({ energyKcal: "estimate", protein: "estimate", carbs: "estimate", fat: "estimate" });
    expect(out.result.hints).toEqual(["Add a photo of the back for exact facts"]);
    expect(out.crowdCandidate).toBeNull();
  });
});

describe("runAi — meal", () => {
  const dal = food({ id: "f-dal", name: "Dal tadka", brand: null, kind: "dish", gradeCategory: "dish", per100: { energyKcal: 110, protein: 5.6, carbs: 13, fat: 4, fibre: 3, sodiumMg: 320 } });
  const rice = food({ id: "f-rice", name: "Steamed rice", brand: null, kind: "dish", gradeCategory: "dish", per100: { energyKcal: 130, protein: 2.7, carbs: 28.2, fat: 0.3, fibre: 0.4, sodiumMg: 1 } });
  const riceRaw = food({ id: "f-rice-raw", name: "Rice, raw", brand: null, kind: "ingredient", gradeCategory: "general", per100: { energyKcal: 360, protein: 7, carbs: 79, fat: 0.6 } });

  function mealSearch(): EngineDeps["searchFoods"] {
    return vi.fn(async ({ name }: { name: string }) => (name === "Dal tadka" ? [dal] : name === "Steamed rice" ? [riceRaw, rice] : []));
  }

  it("one item unmatched → low confidence, per-item provenance, totals summed, dish grade", async () => {
    const d = deps({ extract: extractReturning(mealThali), searchFoods: mealSearch() });
    const out = await runAi(input(), d, DEADLINE, null);
    expect(d.searchFoods).toHaveBeenCalledWith({ name: "Dal tadka", country: "IN" });
    expect(out.result).toMatchObject({ kind: "meal", inputKind: "meal", confidence: "low", foodId: null });
    const items = out.result.items!;
    expect(items.map((i) => [i.name, i.grams, i.provenance])).toEqual([
      ["Dal tadka", 150, "reference"],
      ["Steamed rice", 200, "reference"],
      ["Fried kachri papad", 15, "estimate"],
    ]);
    expect(items.map((i) => i.foodId)).toEqual(["f-dal", "f-rice", undefined]);
    expect(items[0]!.nutrients.energyKcal).toBe(165); // 110 × 1.5 from the catalogue, not the model estimate
    expect(items[1]!.nutrients.energyKcal).toBe(260); // skipped the raw-ingredient hit
    expect(items[2]!.nutrients.energyKcal).toBe(78);
    const totalKcal = 165 + 260 + 78;
    expect(out.result.portions[out.result.defaultPortion]).toMatchObject({ grams: 365 });
    expect(out.result.per100!.energyKcal).toBeCloseTo((totalKcal / 365) * 100, 1);
    expect(out.result.provenance.energyKcal).toBe("estimate");
    expect(out.result.grade).not.toBeNull();
    expect(out.crowdCandidate).toBeNull();
    expect(d.alternatives).not.toHaveBeenCalled();
  });

  const oneItem = (name: string, grams: number, energyKcal: number): Extraction => ({
    images: [{ index: 0, kind: "meal", quality: [] }],
    meal: { items: [{ name, grams, estimate: { energyKcal, protein: 6, carbs: 18, fat: 5 } }] },
  });

  it("rejects a weak name match (\"dal\" vs \"Dal makhani\") and uses the estimate", async () => {
    const makhani = food({ id: "f-makhani", name: "Dal makhani", brand: null, kind: "dish", gradeCategory: "dish", per100: { energyKcal: 120, protein: 5, carbs: 12, fat: 6 } });
    const out = await runAi(input(), deps({ extract: extractReturning(oneItem("dal", 150, 160)), searchFoods: vi.fn(async () => [makhani]) }), DEADLINE, null);
    expect(out.result.items![0]!.provenance).toBe("estimate");
    expect(out.result.items![0]!.foodId).toBeUndefined();
    expect(out.result.items![0]!.nutrients.energyKcal).toBe(160);
    expect(out.result.confidence).toBe("low");
  });

  it("rejects a packaged hit (\"Biryani masala\" spice mix)", async () => {
    const masala = food({ id: "f-masala", name: "Biryani masala", brand: "Spice Co", kind: "packaged", per100: { energyKcal: 300, protein: 10, carbs: 40, fat: 10 } });
    const out = await runAi(input(), deps({ extract: extractReturning(oneItem("Biryani masala", 300, 480)), searchFoods: vi.fn(async () => [masala]) }), DEADLINE, null);
    expect(out.result.items![0]!.provenance).toBe("estimate");
  });

  it("rejects a hit whose kcal for the item's grams is outside 0.5–2× the model estimate", async () => {
    const dense = food({ id: "f-dense", name: "Dal tadka", brand: null, kind: "dish", gradeCategory: "dish", per100: { energyKcal: 400, protein: 20, carbs: 50, fat: 13 } });
    const out = await runAi(input(), deps({ extract: extractReturning(oneItem("Dal tadka", 150, 165)), searchFoods: vi.fn(async () => [dense]) }), DEADLINE, null);
    expect(out.result.items![0]!.provenance).toBe("estimate"); // 600 kcal vs 165 estimate
  });

  it("accepts an exact-name dish hit within the kcal range", async () => {
    const dalTadka = food({ id: "f-dal", name: "Dal tadka", brand: null, kind: "dish", gradeCategory: "dish", per100: { energyKcal: 110, protein: 5.6, carbs: 13, fat: 4 } });
    const out = await runAi(input(), deps({ extract: extractReturning(oneItem("Dal tadka", 150, 200)), searchFoods: vi.fn(async () => [dalTadka]) }), DEADLINE, null);
    expect(out.result.items![0]).toMatchObject({ provenance: "reference", foodId: "f-dal" });
    expect(out.result.items![0]!.nutrients.energyKcal).toBe(165);
    expect(out.result.confidence).toBe("medium");
  });

  it("doesn't look up a barcode read off a meal photo", async () => {
    const d = deps({ extract: extractReturning({ ...mealThali, barcodeText: NAMKEEN_CODE }), searchFoods: mealSearch() });
    await runAi(input(), d, DEADLINE, null);
    expect(d.findFoodByBarcode).not.toHaveBeenCalled();
  });

  it("all items matched → medium confidence", async () => {
    const twoItems = { ...mealThali, meal: { items: mealThali.meal!.items.slice(0, 2) } };
    const out = await runAi(input(), deps({ extract: extractReturning(twoItems), searchFoods: mealSearch() }), DEADLINE, null);
    expect(out.result.confidence).toBe("medium");
    expect(out.result.provenance.energyKcal).toBe("reference");
  });
});

describe("runAi — a barcode the model read off the photo", () => {
  it("is looked up in OFF before use; an OFF hit is cached and a barcode photo gets the normal OFF result", async () => {
    const barcodeOnly: Extraction = { images: [{ index: 0, kind: "barcode", quality: [] }], barcodeText: NAMKEEN_CODE };
    const d = deps({ extract: extractReturning(barcodeOnly), lookupOffByBarcode: vi.fn(async () => ({ status: "found" as const, rec: OFF_REC })), cacheOffFood: vi.fn(async () => food({ id: "f-off" })) });
    const out = await runAi(input(), d, DEADLINE, null);
    expect(d.lookupOffByBarcode).toHaveBeenCalledWith(NAMKEEN_CODE, { timeoutMs: 6000 });
    expect(d.cacheOffFood).toHaveBeenCalledWith(OFF_REC);
    expect(out.result).toMatchObject({ foodId: "f-off", inputKind: "barcode", confidence: "high" });
    expect(out.crowdCandidate).toBeNull();
  });

  it("label + OFF has the product: the crowd candidate keeps OFF's barcode, so the upsert can't claim it", async () => {
    const d = deps({ extract: extractReturning(labelNamkeen), lookupOffByBarcode: vi.fn(async () => ({ status: "found" as const, rec: OFF_REC })), cacheOffFood: vi.fn(async () => food({ id: "f-off" })) });
    const out = await runAi(input(), d, DEADLINE, null);
    expect(d.cacheOffFood).toHaveBeenCalledTimes(1);
    expect(out.result.foodId).toBe("f-off");
    expect(out.crowdCandidate?.barcode).toBe(NAMKEEN_CODE); // a no-op against the OFF row (setWhere source = 'crowd')
  });

  it("label + OFF definitively has no product: the crowd candidate may carry the barcode", async () => {
    const d = deps({ extract: extractReturning(labelNamkeen) });
    const out = await runAi(input(), d, DEADLINE, null);
    expect(d.lookupOffByBarcode).toHaveBeenCalledWith(NAMKEEN_CODE, { timeoutMs: 6000 });
    expect(out.crowdCandidate?.barcode).toBe(NAMKEEN_CODE);
  });

  it("label with an implausible per-100 value (sodium past pure salt): shown as unknown, grade unavailable, retake, never crowd-sourced", async () => {
    // 5,000 mg sodium in a 10 g serving scales to 50,000 mg per 100 g.
    const bad = fx({ ...labelNamkeenJson, barcodeText: null, facts: { basis: "per_serving", servingSize: { value: 10, unit: "g" }, energyKcal: 40, protein: 1, carbs: 8, fat: 0.5, sugars: 1, sodiumMg: 5000 } });
    const out = await runAi(input(), deps({ extract: extractReturning(bad) }), DEADLINE, null);
    expect(out.result.per100).toMatchObject({ energyKcal: 400, protein: 10, carbs: 80, fat: 5, sugars: 10 });
    expect(out.result.per100!.sodiumMg).toBeUndefined();
    expect(out.result.provenance.sodiumMg).toBeUndefined();
    expect(JSON.stringify(out.result.flags)).not.toMatch(/sodium/i);
    // No confident grade on a label missing a value the grade scores.
    expect(out.result.grade).toBeNull();
    expect(out.result.gradeValue).toBeNull();
    expect(out.result.components).toEqual([]);
    expect(out.result.gradeUnavailable).toBe("Sodium on this label isn't plausible, so we can't grade it.");
    expect(out.result.reasons).toEqual([{ tone: "warn", text: "Sodium on this label isn't plausible, so we can't grade it." }]);
    expect(out.result.alternatives).toEqual([]);
    expect(out.result.confidence).toBe("low");
    expect(out.crowdCandidate).toBeNull();
  });

  it("front of pack with an implausible estimate: the value is dropped", async () => {
    const bad = fx({ ...frontOnlyJson, facts: { basis: "per_100g", energyKcal: 400, protein: 10, carbs: 5, fat: 30, sugars: 40 } });
    const out = await runAi(input(), deps({ extract: extractReturning(bad) }), DEADLINE, null);
    expect(out.result.per100).toMatchObject({ energyKcal: 400, carbs: 5 });
    expect(out.result.per100!.sugars).toBeUndefined();
    expect(out.result.provenance.sugars).toBeUndefined();
    expect(out.result.grade).toBeNull();
    expect(out.result.gradeUnavailable).toBe("Sugar in this estimate isn't plausible, so we can't grade it.");
  });

  it("barcode hit on a stored food whose grade is unavailable (read guard): no grade, the reason instead", async () => {
    const reason = "Sodium on this label isn't plausible, so we can't grade it.";
    const d = deps({ findFoodByBarcode: vi.fn(async () => food({ grade: "?", gradeValue: null, gradeComponents: [], gradeUnavailable: reason, per100: { ...food().per100, sodiumMg: undefined } })) });
    const out = await resolveBarcode(input({ barcode: NAMKEEN_CODE, images: [] }), d);
    if (out.kind !== "barcode_done") throw new Error(out.kind);
    expect(out.result.grade).toBeNull();
    expect(out.result.gradeUnavailable).toBe(reason);
    expect(out.result.reasons).toEqual([{ tone: "warn", text: reason }]);
    expect(out.result.alternatives).toEqual([]);
    expect(d.alternatives).not.toHaveBeenCalled();
  });

  it("a graded result never carries gradeUnavailable", async () => {
    const out = await runAi(input(), deps({ extract: extractReturning(labelNamkeen) }), DEADLINE, null);
    expect(out.result.grade).not.toBeNull();
    expect(out.result.gradeUnavailable).toBeUndefined();
  });

  it("label + OFF timed out or down: the crowd candidate never carries the barcode", async () => {
    const d = deps({ extract: extractReturning(labelNamkeen), lookupOffByBarcode: vi.fn(async () => ({ status: "unavailable" as const })) });
    const out = await runAi(input(), d, DEADLINE, null);
    expect(out.crowdCandidate).not.toBeNull();
    expect(out.crowdCandidate!.barcode).toBeNull();
  });

  it("a submitted barcode is never re-queried; its crowd claim follows resolveBarcode's OFF answer", async () => {
    const labelNoCode = { ...labelNamkeen, barcodeText: undefined };
    const unsure = await runAi(input({ barcode: NAMKEEN_CODE }), deps({ extract: extractReturning(labelNoCode) }), DEADLINE, null, false);
    expect(unsure.crowdCandidate!.barcode).toBeNull();
    const d = deps({ extract: extractReturning(labelNoCode) });
    const missed = await runAi(input({ barcode: NAMKEEN_CODE }), d, DEADLINE, null, true);
    expect(missed.crowdCandidate!.barcode).toBe(NAMKEEN_CODE);
    expect(d.lookupOffByBarcode).not.toHaveBeenCalled();
    expect(d.findFoodByBarcode).not.toHaveBeenCalled();
  });
});

describe("runAi — the model-read OFF lookup is bounded by the scan deadline (review N1)", () => {
  it("too little time left: OFF is never called and the code is treated as unavailable (no crowd barcode)", async () => {
    // remaining = deadline - now - 3000 reserve = 900 ms < 1000 ms minimum
    const d = deps({ extract: extractReturning(labelNamkeen), now: () => DEADLINE - 3900 });
    const out = await runAi(input(), d, DEADLINE, null);
    expect(d.lookupOffByBarcode).not.toHaveBeenCalled();
    expect(d.findFoodByBarcode).toHaveBeenCalledWith(NAMKEEN_CODE); // our own DB is still asked
    expect(out.crowdCandidate).not.toBeNull();
    expect(out.crowdCandidate!.barcode).toBeNull();
  });

  it("some time left: the OFF timeout is what remains after the reserve, capped at 6 s", async () => {
    const d = deps({ extract: extractReturning(labelNamkeen), now: () => DEADLINE - 5500 });
    await runAi(input(), d, DEADLINE, null);
    expect(d.lookupOffByBarcode).toHaveBeenCalledWith(NAMKEEN_CODE, { timeoutMs: 2500 });
  });

  it("resolveBarcode (before any model call) keeps the default OFF timeout", async () => {
    const d = deps();
    await resolveBarcode(input({ barcode: NAMKEEN_CODE }), d);
    expect(d.lookupOffByBarcode).toHaveBeenCalledWith(NAMKEEN_CODE);
  });
});

describe("runAi — label merged with a DB food keeps its unmapped OFF tags (review N6)", () => {
  it("an en:celery tag on the barcode food survives the merge", async () => {
    const labelNoCode = { ...labelNamkeen, barcodeText: undefined };
    const dbFood = food({ allergens: ["en:peanuts", "en:celery"], mayContain: ["en:milk", "en:lupin"] });
    const out = await runAi(input({ barcode: NAMKEEN_CODE }), deps({ extract: extractReturning(labelNoCode) }), DEADLINE, dbFood, false);
    expect(out.result.allergens).toEqual(expect.arrayContaining(["en:peanuts", "en:celery"]));
    expect(out.result.mayContain).toEqual(expect.arrayContaining(["en:milk", "en:lupin"]));
    expect(out.crowdCandidate?.allergens).toEqual(expect.arrayContaining(["en:celery"]));
  });
});

describe("runAi — triage", () => {
  it("all not_food → NOT_FOOD", async () => {
    expect((await engineError(runAi(input(), deps({ extract: extractReturning(notFood) }), DEADLINE, null))).code).toBe("NOT_FOOD");
  });

  it("all unreadable → UNREADABLE_IMAGE", async () => {
    expect((await engineError(runAi(input(), deps({ extract: extractReturning(unreadable) }), DEADLINE, null))).code).toBe("UNREADABLE_IMAGE");
  });

  it("every image has quality issues and nothing was extracted → UNREADABLE_IMAGE", async () => {
    const blurryPanel: Extraction = { images: [{ index: 0, kind: "nutrition_panel", quality: ["blurry"] }] };
    expect((await engineError(runAi(input(), deps({ extract: extractReturning(blurryPanel) }), DEADLINE, null))).code).toBe("UNREADABLE_IMAGE");
  });

  it("barcode-only image with no readable code → UNREADABLE_IMAGE", async () => {
    const barcodeOnly: Extraction = { images: [{ index: 0, kind: "barcode", quality: [] }], barcodeText: "12345" };
    const d = deps({ extract: extractReturning(barcodeOnly) });
    expect((await engineError(runAi(input(), d, DEADLINE, null))).code).toBe("UNREADABLE_IMAGE");
    expect(d.findFoodByBarcode).not.toHaveBeenCalled();
  });

  it("barcode-only image whose code is in our DB → result from the food", async () => {
    const barcodeOnly: Extraction = { images: [{ index: 0, kind: "barcode", quality: [] }], barcodeText: NAMKEEN_CODE };
    const out = await runAi(input(), deps({ extract: extractReturning(barcodeOnly), findFoodByBarcode: vi.fn(async () => food()) }), DEADLINE, null);
    expect(out.result).toMatchObject({ foodId: "f-bhujia", confidence: "high", inputKind: "barcode" });
    expect(out.crowdCandidate).toBeNull();
  });

  it("not_food images mixed with a label are ignored", async () => {
    const mixed = { ...labelNamkeen, images: [...labelNamkeen.images.slice(0, 2), { index: 2, kind: "not_food" as const, quality: [] }] };
    const out = await runAi(input(), deps({ extract: extractReturning(mixed) }), DEADLINE, null);
    expect(out.result.inputKind).toBe("label");
  });

  it("extract throwing TIMEOUT propagates", async () => {
    const d = deps({ extract: vi.fn(async () => { throw new EngineError("TIMEOUT", "The scan took too long and timed out. Please try again."); }) });
    expect((await engineError(runAi(input(), d, DEADLINE, null))).code).toBe("TIMEOUT");
  });
});
