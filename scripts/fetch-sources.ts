import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync, unzipSync, strFromU8 } from "fflate";
import ExcelJS from "exceljs";
import type { Nutrients, Portion } from "@/lib/nutrition/types";
import type { SourceRecord } from "@/lib/foods/seed-map";
// toSourceRecordOFF/OffRow now live in lib/foods/off-map.ts (shared with the runtime barcode lookup in
// lib/engine/off.ts); re-exported here so nothing that imports them from this script breaks.
import { toSourceRecordOFF, type OffRow } from "@/lib/foods/off-map";

export { toSourceRecordOFF };
export type { OffRow };

const OUT = "data/sources";
const num = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};
const r3 = (n: number) => Math.round(n * 1000) / 1000;
function clean(n: Partial<Nutrients>): Nutrients {
  const out: Partial<Nutrients> = {};
  for (const [k, v] of Object.entries(n)) if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[k as keyof Nutrients] = r3(v);
  return out as Nutrients;
}

export function toSourceRecordINDB(row: Record<string, unknown>): SourceRecord | null {
  const kcal = num(row.energy_kcal);
  const name = typeof row.food_name === "string" ? row.food_name.trim() : "";
  if (!kcal || !name) return null;
  const per100 = clean({
    energyKcal: kcal, protein: num(row.protein_g) ?? 0, carbs: num(row.carb_g) ?? 0, fat: num(row.fat_g) ?? 0,
    fibre: num(row.fibre_g), addedSugars: num(row.freesugar_g), sugars: num(row.freesugar_g),
    satFat: num(row.sfa_mg) !== undefined ? num(row.sfa_mg)! / 1000 : undefined, sodiumMg: num(row.sodium_mg),
  });
  const servKcal = num(row.unit_serving_energy_kcal);
  const unit = typeof row.servings_unit === "string" ? row.servings_unit.trim() : "";
  const portions: Portion[] = servKcal && unit ? [{ label: `1 ${unit}`, amount: 1, unit: "household", grams: Math.round((servKcal / kcal) * 100) }] : [];
  return { source: "indb", sourceRef: String(row.food_code), name, basis: "per_100g", per100, portions, countries: ["IN"] };
}

interface FnddsFood {
  fdcId: number; description: string; wweiaFoodCategory?: { wweiaFoodCategoryDescription?: string };
  foodNutrients: { nutrient: { number: string }; amount?: number }[];
  foodPortions?: { portionDescription: string; gramWeight: number }[];
}
const FNDDS_NUM: Record<string, keyof Nutrients> = { "208": "energyKcal", "203": "protein", "205": "carbs", "204": "fat", "269": "sugars", "291": "fibre", "606": "satFat", "307": "sodiumMg" };

export function toSourceRecordFNDDS(f: FnddsFood): SourceRecord | null {
  const n: Partial<Nutrients> = {};
  for (const fn of f.foodNutrients) {
    const key = FNDDS_NUM[fn.nutrient.number];
    if (key && typeof fn.amount === "number") n[key] = fn.amount;
  }
  if (n.energyKcal === undefined || n.protein === undefined || n.carbs === undefined || n.fat === undefined) return null;
  const portions: Portion[] = (f.foodPortions ?? [])
    .filter((p) => p.gramWeight > 0 && !/not specified/i.test(p.portionDescription))
    .slice(0, 6)
    .map((p) => ({ label: p.portionDescription, amount: 1, unit: "household", grams: Math.round(p.gramWeight) }));
  return { source: "fndds", sourceRef: String(f.fdcId), name: f.description, basis: "per_100g", per100: clean(n), portions, wweia: f.wweiaFoodCategory?.wweiaFoodCategoryDescription, countries: ["US"] };
}

async function fetchINDB() {
  const res = await fetch("https://raw.githubusercontent.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-/main/INDB.xlsx");
  if (!res.ok) throw new Error(`INDB download failed: ${res.status}`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await res.arrayBuffer()) as unknown as ExcelJS.Buffer);
  const ws = wb.worksheets[0]!;
  const cellText = (v: unknown): unknown => {
    if (v && typeof v === "object") {
      if ("text" in v) return (v as { text: unknown }).text;
      if ("result" in v) return (v as { result: unknown }).result;
      if ("richText" in v) return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
    }
    return v;
  };
  const header = (ws.getRow(1).values as unknown[]).slice(1).map((v) => String(cellText(v)));
  console.log("INDB header:", header);
  const lines: string[] = [];
  let printedFirst = false;
  ws.eachRow((row, i) => {
    if (i === 1) return;
    const vals = (row.values as unknown[]).slice(1).map(cellText);
    const obj = Object.fromEntries(header.map((h, j) => [h, vals[j]]));
    if (!printedFirst) {
      console.log("INDB first row:", obj);
      printedFirst = true;
    }
    const rec = toSourceRecordINDB(obj);
    if (rec) lines.push(JSON.stringify(rec));
  });
  writeFileSync(`${OUT}/indb.jsonl`, lines.join("\n") + "\n");
  console.log(`INDB: ${lines.length} records`);
}

async function fetchFNDDS() {
  const res = await fetch("https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_survey_food_json_2024-10-31.zip");
  if (!res.ok) throw new Error(`FNDDS download failed: ${res.status}`);
  const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
  const jsonName = Object.keys(files).find((k) => k.endsWith(".json"))!;
  const foods = (JSON.parse(strFromU8(files[jsonName]!)) as { SurveyFoods: FnddsFood[] }).SurveyFoods;
  const lines = foods.map(toSourceRecordFNDDS).filter((r): r is SourceRecord => r !== null).map((r) => JSON.stringify(r));
  writeFileSync(`${OUT}/fndds.jsonl`, lines.join("\n") + "\n");
  console.log(`FNDDS: ${lines.length} records (of ${foods.length})`);
}

async function fetchOFFIndia() {
  const { DuckDBInstance } = await import("@duckdb/node-api");
  const inst = await DuckDBInstance.create(":memory:");
  const con = await inst.connect();
  await con.run("INSTALL httpfs; LOAD httpfs;");
  // HF rate-limits (HTTP 429) bursts of range requests against this ~5.7 GB file; back off and retry.
  await con.run("SET http_retries=12; SET http_retry_wait_ms=3000; SET http_retry_backoff=1.8; SET http_timeout=120000;");
  const url = "https://huggingface.co/datasets/openfoodfacts/product-database/resolve/main/food.parquet";
  const reader = await con.runAndReadAll(`
    SELECT code, product_name, brands, categories_tags, nutriments, serving_quantity, product_quantity,
           nova_group, additives_tags, allergens_tags, traces_tags, ingredients_text, nutriscore_grade
    FROM read_parquet('${url}')
    WHERE list_contains(countries_tags, 'en:india')`);
  const rows = reader.getRowObjectsJson() as unknown as Record<string, unknown>[];
  const lines: string[] = [];
  for (const raw of rows) {
    const rec = toSourceRecordOFF(offRowFromParquet(raw));
    if (rec) lines.push(JSON.stringify(rec));
  }
  writeFileSync(`${OUT}/off-in.jsonl.gz`, gzipSync(new TextEncoder().encode(lines.join("\n") + "\n")));
  console.log(`OFF India: ${lines.length} records (of ${rows.length})`);
}

// Observed Parquet schema (via DESCRIBE, 2026-10-06): product_name and ingredients_text are
// STRUCT(lang, text)[]; nutriments is STRUCT(name, value, "100g", serving, unit, prepared_*)[];
// serving_quantity/product_quantity are VARCHAR (numeric strings, e.g. "305"); the grade column
// is named nutriscore_grade, not nutrition_grades. No direct front-image-URL column is exposed.
export function offRowFromParquet(raw: Record<string, unknown>): OffRow {
  const pickText = (v: unknown) => Array.isArray(v) ? ((v.find((x: { lang?: string }) => x.lang === "main" || x.lang === "en") ?? v[0]) as { text?: string } | undefined)?.text : (v as string | undefined);
  const nutriments: Record<string, unknown> = {};
  if (Array.isArray(raw.nutriments)) for (const n of raw.nutriments as { name: string; "100g"?: number }[]) nutriments[`${n.name}_100g`] = n["100g"];
  return {
    code: String(raw.code), product_name: pickText(raw.product_name), brands: raw.brands as string | undefined,
    categories_tags: raw.categories_tags as string[] | undefined, nutriments, serving_quantity: raw.serving_quantity,
    product_quantity: raw.product_quantity, nova_group: raw.nova_group, additives_tags: raw.additives_tags as string[] | undefined,
    allergens_tags: raw.allergens_tags as string[] | undefined, traces_tags: raw.traces_tags as string[] | undefined,
    ingredients_text: pickText(raw.ingredients_text), nutrition_grades: raw.nutriscore_grade as string | undefined,
    // The Parquet query (fetchOFFIndia below) already filters `WHERE list_contains(countries_tags, 'en:india')`
    // without selecting that column, so every row here is India-tagged — synthesize the tag rather than the
    // ISO code, so toSourceRecordOFF's generic countries_tags mapping (not a hardcoded ["IN"]) still applies.
    countries_tags: ["en:india"],
  };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const only = process.argv[2];
  if (!only || only === "indb") await fetchINDB();
  if (!only || only === "fndds") await fetchFNDDS();
  if (!only || only === "off") await fetchOFFIndia();
}
if (process.argv[1]?.endsWith("fetch-sources.ts")) main().catch((e) => { console.error(e); process.exit(1); });
