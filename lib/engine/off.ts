import { toSourceRecordOFF, type OffRow } from "@/lib/foods/off-map";
import type { SourceRecord } from "@/lib/foods/seed-map";

// lib/env.ts's env() requires auth vars to be set (same reasoning as lib/engine/model.ts's
// readModelConfig), so this file — the one other file in lib/engine allowed network access
// (constraints.md: "lib/engine/off.ts is the network module") — reads OFF_CONTACT_EMAIL directly
// from process.env instead, exactly like app/(marketing)/privacy and terms already do. It's
// optional: Open Food Facts just asks for a contact in the User-Agent, not a credential, so the
// app works without it.
const FIELDS = [
  "code", "product_name", "brands", "categories_tags", "nutriments", "serving_quantity", "product_quantity",
  "nova_group", "additives_tags", "allergens_tags", "traces_tags", "ingredients_text", "nutrition_grades",
  // Plan-review amendment: needed so toSourceRecordOFF can map real countries from countries_tags
  // instead of a hardcoded country (see lib/foods/off-map.ts).
  "countries_tags",
].join(",");

const TIMEOUT_MS = 6000;

interface OffApiResponse { status?: number; product?: OffRow }

export async function fetchOffByBarcode(code: string, fetchImpl: typeof fetch = fetch): Promise<SourceRecord | null> {
  const contactEmail = process.env.OFF_CONTACT_EMAIL || "contact via app";
  const url = `https://world.openfoodfacts.org/api/v2/product/${code}?fields=${FIELDS}`;

  let res: Response;
  try {
    res = await fetchImpl(url, {
      headers: { "User-Agent": `EATRi8/2.0 (${contactEmail})` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // Network error, DNS failure, or our own timeout firing — all treated as "couldn't look it up".
    return null;
  }

  if (!res.ok) return null; // incl. 404 (unknown barcode)

  let body: OffApiResponse;
  try {
    body = (await res.json()) as OffApiResponse;
  } catch {
    return null; // malformed JSON body
  }

  // OFF's v2 API returns HTTP 200 with status: 0 (and no product) for a well-formed but unknown barcode.
  if (body.status === 0 || !body.product) return null;

  return toSourceRecordOFF(body.product);
}
