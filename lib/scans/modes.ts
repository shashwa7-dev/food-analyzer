// The scanner's modes (spec §6.8) and the Analysing card's cosmetic step timer (§6.10). Pure: safe in client bundles.

export type ScanMode = "barcode" | "label" | "front" | "meal";

/** The hint pill under the frame. The mode only changes this hint; barcode detection runs in every mode. */
export const MODE_HINT: Record<ScanMode, string> = {
  barcode: "Point at a barcode",
  label: "Fit the nutrition table inside the frame",
  front: "Show the front of the pack",
  meal: "Get the whole plate in",
};

const MODES = Object.keys(MODE_HINT) as ScanMode[];

/** `?mode=` from the URL; anything unknown (or missing) is "label". */
export function parseMode(v: string | null): ScanMode {
  return MODES.includes(v as ScanMode) ? (v as ScanMode) : "label";
}

/**
 * The Analysing card's current step. The server only reports queued/processing/done, so the steps
 * advance every 2 s and hold on the third while running; the last ("Finding better options") only
 * shows once the scan is done, just before the result replaces the card.
 */
export function analysingStep(elapsedMs: number, done: boolean): 0 | 1 | 2 | 3 {
  if (done) return 3;
  return Math.min(2, Math.max(0, Math.floor(elapsedMs / 2000))) as 0 | 1 | 2;
}
