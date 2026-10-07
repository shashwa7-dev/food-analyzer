import { normaliseBarcode } from "./barcode";
import { toSourceRecordOFF, type OffRow } from "@/lib/foods/off-map";
import type { SourceRecord } from "@/lib/foods/seed-map";

// lib/env.ts's env() requires auth vars to be set (same reasoning as lib/engine/model.ts's
// readModelConfig), so this file — the task-6 brief's designated network module for OFF lookups,
// the one other file in lib/engine (besides model.ts) allowed network access — reads
// OFF_CONTACT_EMAIL directly from process.env instead, exactly like app/(marketing)/privacy and
// terms already do. It's optional: Open Food Facts just asks for a contact in the User-Agent,
// not a credential, so the app works without it.
const FIELDS = [
  "code", "product_name", "brands", "categories_tags", "nutriments", "serving_quantity", "product_quantity",
  "nova_group", "additives_tags", "allergens_tags", "traces_tags", "ingredients_text", "nutrition_grades",
  // Plan-review amendment: needed so toSourceRecordOFF can map real countries from countries_tags
  // instead of a hardcoded country (see lib/foods/off-map.ts).
  "countries_tags",
].join(",");

const TIMEOUT_MS = 6000;

interface OffApiResponse { status?: number; product?: OffRow }

/**
 * found: OFF has a usable product. not_found: OFF answered definitively that it has no product for
 * this code (404 / status 0). unavailable: anything else (timeout, network or HTTP error, bad JSON,
 * or a product too incomplete to use) — "we don't know", never evidence that OFF lacks the product.
 */
export type OffLookup = { status: "found"; rec: SourceRecord } | { status: "not_found" } | { status: "unavailable" };

export interface OffLookupOptions {
  /** Request timeout, capped at the default 6 s (review N1: the model-read path passes what's left of the scan deadline). */
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export async function lookupOffByBarcode(code: string, opts: OffLookupOptions = {}): Promise<OffLookup> {
  const { fetchImpl = fetch } = opts;
  const timeoutMs = Math.max(0, Math.min(TIMEOUT_MS, opts.timeoutMs ?? TIMEOUT_MS));
  // Untrusted input (a scanned/typed barcode) — validate and normalise (EAN-8/EAN-13/UPC-A check
  // digit) before it ever reaches a URL, instead of interpolating the raw string.
  const normalised = normaliseBarcode(code);
  if (!normalised) return { status: "unavailable" };

  const contactEmail = process.env.OFF_CONTACT_EMAIL || "contact via app";
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(normalised)}?fields=${FIELDS}`;

  let res: Response;
  try {
    res = await fetchImpl(url, {
      headers: { "User-Agent": `EATRi8/2.0 (${contactEmail})` },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    // Network error, DNS failure, or our own timeout firing — all treated as "couldn't look it up".
    return { status: "unavailable" };
  }

  if (res.status === 404) return { status: "not_found" }; // unknown barcode
  if (!res.ok) return { status: "unavailable" };

  let body: OffApiResponse;
  try {
    body = (await res.json()) as OffApiResponse;
  } catch {
    return { status: "unavailable" }; // malformed JSON body
  }

  // OFF's v2 API returns HTTP 200 with status: 0 (and no product) for a well-formed but unknown barcode.
  if (body.status === 0) return { status: "not_found" };
  if (!body.product) return { status: "unavailable" }; // not a shape we recognise: no evidence either way

  const rec = toSourceRecordOFF(body.product);
  return rec ? { status: "found", rec } : { status: "unavailable" }; // OFF has it, just not usable
}

/** lookupOffByBarcode, collapsed to "a usable record or null". */
export async function fetchOffByBarcode(code: string, fetchImpl: typeof fetch = fetch): Promise<SourceRecord | null> {
  const r = await lookupOffByBarcode(code, { fetchImpl });
  return r.status === "found" ? r.rec : null;
}
