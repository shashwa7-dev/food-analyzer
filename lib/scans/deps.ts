// Production wiring of the engine's dependencies (EngineDeps) for one user's scan.
import { env } from "@/lib/env";
import { extract } from "@/lib/engine/model";
import { lookupOffByBarcode } from "@/lib/engine/off";
import { cacheOffFood } from "@/lib/foods/insert";
import { toFoodDraft } from "@/lib/foods/seed-map";
import { findAlternatives, findFoodByBarcode, searchFoodRows } from "@/lib/foods/service";
import type { ScanDeps } from "./service";

const NAME_MATCH_CANDIDATES = 10;

export function realDeps(userId: string): ScanDeps {
  return {
    findFoodByBarcode: (code) => findFoodByBarcode(code),
    lookupOffByBarcode: (code) => lookupOffByBarcode(code),
    // Upsert on (source, source_ref) — an OFF row's sourceRef is its barcode; a crowd row holding the code gives it up.
    cacheOffFood: (rec) => cacheOffFood(toFoodDraft(rec, [])),
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
