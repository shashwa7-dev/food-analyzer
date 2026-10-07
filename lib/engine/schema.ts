import { z } from "zod";

// Images are used in memory for the model call and discarded (no R2, no thumbnails in M2).
export type EngineImage = { mime: "image/jpeg" | "image/png" | "image/webp"; data: Uint8Array };

const IMAGE_KINDS = ["barcode", "nutrition_panel", "ingredients", "front", "meal", "not_food", "unreadable"] as const;
const QUALITY_FLAGS = ["blurry", "glare", "cropped", "too_dark"] as const;
const UNITS = ["g", "ml"] as const;
const BASES = ["per_100g", "per_100ml", "per_serving"] as const;

type ImageKind = (typeof IMAGE_KINDS)[number];
type QualityFlag = (typeof QUALITY_FLAGS)[number];
type Unit = (typeof UNITS)[number];
type Basis = (typeof BASES)[number];

// --- Strict schema: what the rest of the engine trusts. Label text is untrusted input, so
// every string is length-capped and every number range-checked (spec §7.2). ---
const num = (max: number) => z.number().min(0).max(max).optional();

export const ExtractionSchema = z.object({
  images: z
    .array(
      z.object({
        index: z.number().int().min(0).max(2),
        kind: z.enum(IMAGE_KINDS),
        quality: z.array(z.enum(QUALITY_FLAGS)).max(4),
      }),
    )
    .max(3),
  barcodeText: z.string().max(20).optional(),
  product: z
    .object({
      name: z.string().max(120),
      brand: z.string().max(80).optional(),
      variant: z.string().max(80).optional(),
      categoryGuess: z.string().max(80).optional(),
      packSize: z.object({ value: z.number().min(0).max(10000), unit: z.enum(UNITS) }).optional(),
    })
    .optional(),
  facts: z
    .object({
      basis: z.enum(BASES),
      servingSize: z.object({ value: z.number().min(0).max(2000), unit: z.enum(UNITS) }).optional(),
      energyKcal: num(5000),
      energyKj: num(20000),
      protein: num(500),
      carbs: num(500),
      sugars: num(500),
      addedSugars: num(500),
      fat: num(500),
      satFat: num(500),
      transFat: num(500),
      fibre: num(500),
      sodiumMg: num(20000),
      saltG: num(50),
    })
    .optional(),
  ingredients: z.array(z.string().max(80)).max(80).optional(),
  allergensDeclared: z.array(z.string().max(40)).max(20).optional(),
  mayContain: z.array(z.string().max(40)).max(20).optional(),
  additives: z.array(z.string().max(20)).max(40).optional(),
  meal: z
    .object({
      items: z
        .array(
          z.object({
            name: z.string().max(80),
            grams: z.number().min(1).max(2000),
            estimate: z.object({
              energyKcal: z.number().min(0).max(5000),
              protein: z.number().min(0).max(500),
              carbs: z.number().min(0).max(500),
              fat: z.number().min(0).max(500),
              fibre: num(500),
              sugars: num(500),
              sodiumMg: num(20000),
            }),
          }),
        )
        .max(20),
    })
    .optional(),
  printedLanguage: z.string().max(20).optional(),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

// --- Lenient schema: what the model is actually asked for. No caps, numbers unconstrained,
// every field nullish (models return null far more reliably than they omit keys). Raw model
// output is validated against this, then passed through sanitiseExtraction below. ---
const lenientNum = z.number().nullish();

export const ModelExtractionSchema = z.object({
  images: z
    .array(
      z.object({
        index: z.number().nullish(),
        kind: z.enum(IMAGE_KINDS).nullish(),
        quality: z.array(z.enum(QUALITY_FLAGS).nullish()).nullish(),
      }),
    )
    .nullish(),
  barcodeText: z.string().nullish(),
  product: z
    .object({
      name: z.string().nullish(),
      brand: z.string().nullish(),
      variant: z.string().nullish(),
      categoryGuess: z.string().nullish(),
      packSize: z.object({ value: z.number().nullish(), unit: z.enum(UNITS).nullish() }).nullish(),
    })
    .nullish(),
  facts: z
    .object({
      basis: z.enum(BASES).nullish(),
      servingSize: z.object({ value: z.number().nullish(), unit: z.enum(UNITS).nullish() }).nullish(),
      energyKcal: lenientNum,
      energyKj: lenientNum,
      protein: lenientNum,
      carbs: lenientNum,
      sugars: lenientNum,
      addedSugars: lenientNum,
      fat: lenientNum,
      satFat: lenientNum,
      transFat: lenientNum,
      fibre: lenientNum,
      sodiumMg: lenientNum,
      saltG: lenientNum,
    })
    .nullish(),
  ingredients: z.array(z.string().nullish()).nullish(),
  allergensDeclared: z.array(z.string().nullish()).nullish(),
  mayContain: z.array(z.string().nullish()).nullish(),
  additives: z.array(z.string().nullish()).nullish(),
  meal: z
    .object({
      items: z
        .array(
          z.object({
            name: z.string().nullish(),
            grams: z.number().nullish(),
            estimate: z
              .object({
                energyKcal: z.number().nullish(),
                protein: z.number().nullish(),
                carbs: z.number().nullish(),
                fat: z.number().nullish(),
                fibre: lenientNum,
                sugars: lenientNum,
                sodiumMg: lenientNum,
              })
              .nullish(),
          }),
        )
        .nullish(),
    })
    .nullish(),
  printedLanguage: z.string().nullish(),
});
export type ModelExtraction = z.infer<typeof ModelExtractionSchema>;

// --- sanitiseExtraction: pure conversion from whatever the model (or a malformed test
// fixture) produced to the strict Extraction type. Truncates strings, slices arrays, drops
// nulls, non-finite numbers and out-of-range numbers — never throws, regardless of input
// shape (that's what the strict schema is for, on trusted input). raw is `unknown` on
// purpose: this is the last line of defense against garbage, not just a ModelExtraction
// post-processor, so every field access below is guarded rather than assumed. ---
const clampStr = (v: unknown, max: number): string | undefined => (typeof v === "string" ? v.slice(0, max) : undefined);

const clampNum = (v: unknown, max: number): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? v : undefined;

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

// A "plain object" entry: not null, not an array, not a primitive (string/number/...).
const asRecord = (v: unknown): Record<string, unknown> => (v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

function clampStrArray(v: unknown, maxItems: number, maxLen: number): string[] {
  const items: string[] = [];
  for (const raw of asArray(v)) {
    const s = clampStr(raw, maxLen);
    if (s !== undefined) items.push(s);
    if (items.length === maxItems) break;
  }
  return items;
}

const isUnit = (v: unknown): v is Unit => (UNITS as readonly string[]).includes(v as string);
const isImageKind = (v: unknown): v is ImageKind => (IMAGE_KINDS as readonly string[]).includes(v as string);
const isQualityFlag = (v: unknown): v is QualityFlag => (QUALITY_FLAGS as readonly string[]).includes(v as string);
const isBasis = (v: unknown): v is Basis => (BASES as readonly string[]).includes(v as string);

export function sanitiseExtraction(raw: unknown): Extraction {
  const r = asRecord(raw);

  const images = asArray(r.images)
    .map(asRecord)
    .filter((img) => isImageKind(img.kind))
    .slice(0, 3)
    .map((img, i) => ({
      index: typeof img.index === "number" && Number.isInteger(img.index) && img.index >= 0 && img.index <= 2 ? img.index : i,
      kind: img.kind as ImageKind,
      quality: asArray(img.quality).filter(isQualityFlag).slice(0, 4),
    }));

  const productRec = asRecord(r.product);
  const name = clampStr(productRec.name, 120);
  const product =
    name !== undefined
      ? {
          name,
          brand: clampStr(productRec.brand, 80),
          variant: clampStr(productRec.variant, 80),
          categoryGuess: clampStr(productRec.categoryGuess, 80),
          packSize: (() => {
            const packSizeRec = asRecord(productRec.packSize);
            return isUnit(packSizeRec.unit) && clampNum(packSizeRec.value, 10000) !== undefined
              ? { value: packSizeRec.value as number, unit: packSizeRec.unit }
              : undefined;
          })(),
        }
      : undefined;

  const factsRec = asRecord(r.facts);
  const basis: Basis | undefined = isBasis(factsRec.basis) ? factsRec.basis : undefined;
  const facts = basis
    ? {
        basis,
        servingSize: (() => {
          const servingSizeRec = asRecord(factsRec.servingSize);
          return isUnit(servingSizeRec.unit) && clampNum(servingSizeRec.value, 2000) !== undefined
            ? { value: servingSizeRec.value as number, unit: servingSizeRec.unit }
            : undefined;
        })(),
        energyKcal: clampNum(factsRec.energyKcal, 5000),
        energyKj: clampNum(factsRec.energyKj, 20000),
        protein: clampNum(factsRec.protein, 500),
        carbs: clampNum(factsRec.carbs, 500),
        sugars: clampNum(factsRec.sugars, 500),
        addedSugars: clampNum(factsRec.addedSugars, 500),
        fat: clampNum(factsRec.fat, 500),
        satFat: clampNum(factsRec.satFat, 500),
        transFat: clampNum(factsRec.transFat, 500),
        fibre: clampNum(factsRec.fibre, 500),
        sodiumMg: clampNum(factsRec.sodiumMg, 20000),
        saltG: clampNum(factsRec.saltG, 50),
      }
    : undefined;

  const ingredients = clampStrArray(r.ingredients, 80, 80);
  const allergensDeclared = clampStrArray(r.allergensDeclared, 20, 40);
  const mayContain = clampStrArray(r.mayContain, 20, 40);
  const additives = clampStrArray(r.additives, 40, 20);

  const mealItems = asArray(asRecord(r.meal).items)
    .map((it) => {
      const itemRec = asRecord(it);
      const itemName = clampStr(itemRec.name, 80);
      const grams = typeof itemRec.grams === "number" && Number.isFinite(itemRec.grams) && itemRec.grams >= 1 && itemRec.grams <= 2000 ? itemRec.grams : undefined;
      const est = asRecord(itemRec.estimate);
      const energyKcal = clampNum(est.energyKcal, 5000);
      const protein = clampNum(est.protein, 500);
      const carbs = clampNum(est.carbs, 500);
      const fat = clampNum(est.fat, 500);
      if (itemName === undefined || grams === undefined || energyKcal === undefined || protein === undefined || carbs === undefined || fat === undefined) {
        return null;
      }
      return {
        name: itemName,
        grams,
        estimate: { energyKcal, protein, carbs, fat, fibre: clampNum(est.fibre, 500), sugars: clampNum(est.sugars, 500), sodiumMg: clampNum(est.sodiumMg, 20000) },
      };
    })
    .filter((it): it is NonNullable<typeof it> => it != null)
    .slice(0, 20);

  const sanitised = {
    images,
    barcodeText: clampStr(r.barcodeText, 20),
    product,
    facts,
    ingredients: ingredients.length > 0 ? ingredients : undefined,
    allergensDeclared: allergensDeclared.length > 0 ? allergensDeclared : undefined,
    mayContain: mayContain.length > 0 ? mayContain : undefined,
    additives: additives.length > 0 ? additives : undefined,
    meal: mealItems.length > 0 ? { items: mealItems } : undefined,
    printedLanguage: clampStr(r.printedLanguage, 20),
  };

  return ExtractionSchema.parse(sanitised);
}
