import { existsSync, readFileSync } from "node:fs";
import { gunzipSync, strFromU8 } from "fflate";
import { upsertFoods } from "@/lib/foods/insert";
import { parseHouseholdCsv, toFoodDraft, type FoodDraft, type SourceRecord } from "@/lib/foods/seed-map";

function readJsonl(path: string): SourceRecord[] {
  if (!existsSync(path)) { console.warn(`skip: ${path} not found`); return []; }
  const raw = path.endsWith(".gz") ? strFromU8(gunzipSync(readFileSync(path))) : readFileSync(path, "utf8");
  return raw.split("\n").filter(Boolean).map((l) => JSON.parse(l) as SourceRecord);
}

async function main() {
  const rules = parseHouseholdCsv(readFileSync("data/sources/portions-in.csv", "utf8"));
  const seenBarcodes = new Set<string>();
  const drafts: FoodDraft[] = [];
  for (const file of ["data/sources/indb.jsonl", "data/sources/fndds.jsonl", "data/sources/off-in.jsonl.gz"]) {
    for (const rec of readJsonl(file)) {
      if (rec.barcode) { if (seenBarcodes.has(rec.barcode)) continue; seenBarcodes.add(rec.barcode); }
      drafts.push(toFoodDraft(rec, rules));
    }
  }
  // Spec §6.2.4: within a source, drop near-identical names (same normName + brand); keep the first.
  const seen = new Set<string>();
  const unique = drafts.filter((d) => { const k = `${d.source}|${d.normName}|${d.normBrand}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const n = await upsertFoods(unique);
  console.log(`seeded ${n} foods (${drafts.length - unique.length} duplicates dropped)`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
