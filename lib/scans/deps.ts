// Production wiring of the engine's dependencies (EngineDeps) for one user's scan.
import { env } from "@/lib/env";
import { extract } from "@/lib/engine/model";
import { fetchOffByBarcode } from "@/lib/engine/off";
import { upsertFood } from "@/lib/foods/insert";
import { toFoodDraft } from "@/lib/foods/seed-map";
import { findAlternatives, findFoodByBarcode, searchFoodRows } from "@/lib/foods/service";
import type { ScanDeps } from "./service";

const NAME_MATCH_CANDIDATES = 10;

export function realDeps(userId: string): ScanDeps {
  return {
    findFoodByBarcode: (code) => findFoodByBarcode(code),
    fetchOffByBarcode: (code) => fetchOffByBarcode(code),
    // Single upsert on (source, source_ref) — an OFF row's sourceRef is its barcode.
    cacheOffFood: (rec) => upsertFood(toFoodDraft(rec, [])),
    // Visibility is the scanning user's (shared foods + their own custom foods).
    searchFoods: ({ name, country }) => searchFoodRows(userId, name, country, NAME_MATCH_CANDIDATES),
    alternatives: (f) => findAlternatives(userId, f),
    // Bound to MODEL_FAST (the engine only ever asks for "fast" in M2).
    extract: (images, opts) => extract(images, { ...opts, model: "fast" }),
    now: () => Date.now(),
    config: () => {
      const e = env();
      return { aiEnabled: Boolean(e.GOOGLE_GENERATIVE_AI_API_KEY), dailyAiScanCap: e.DAILY_AI_SCAN_CAP };
    },
  };
}
