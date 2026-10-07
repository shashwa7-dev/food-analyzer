// Pure display helpers for the scan history list (Task 11). No imports, safe in client bundles —
// mirrors the style of ./messages.ts.

/** Matches scanInputKindEnum in lib/db/schema.ts ("barcode" | "label" | "front" | "meal"). */
export const INPUT_KIND_LABELS = {
  barcode: "Barcode",
  label: "Label",
  front: "Front of pack",
  meal: "Meal photo",
} as const;

export function inputKindLabel(kind: string | null): string | null {
  return kind !== null && kind in INPUT_KIND_LABELS ? INPUT_KIND_LABELS[kind as keyof typeof INPUT_KIND_LABELS] : null;
}

/** Matches confidenceEnum in lib/db/schema.ts ("high" | "medium" | "low"). */
export const CONFIDENCE_LABELS = {
  high: "High",
  medium: "Medium",
  low: "Low",
} as const;

export function confidenceLabel(confidence: string | null): string | null {
  return confidence !== null && confidence in CONFIDENCE_LABELS ? CONFIDENCE_LABELS[confidence as keyof typeof CONFIDENCE_LABELS] : null;
}

type ScanSummary = { status: string; errorCode: string | null; name: string | null; inputKind: string | null; charged: boolean };

export const isScanRunning = (s: Pick<ScanSummary, "status">) => s.status === "queued" || s.status === "processing";
/** A failed scan, or one that finished with no result (BARCODE_NOT_FOUND is done with an error code). */
export const isScanFailed = (s: Pick<ScanSummary, "status" | "errorCode">) => s.status === "failed" || s.errorCode !== null;

/** A scan row's title: "Analysing…" while running, the failure, else the product or meal name. */
export function scanTitle(s: Pick<ScanSummary, "status" | "errorCode" | "name">): string {
  if (isScanRunning(s)) return "Analysing…";
  if (isScanFailed(s)) return s.errorCode === "BARCODE_NOT_FOUND" ? "Barcode not found" : "Scan failed";
  return s.name ?? "Scan";
}

/** Today's Recent scans meta: "Barcode · free" for a barcode that cost nothing, else the input kind ("Label", "Meal photo"). */
export function recentScanMeta(s: Pick<ScanSummary, "inputKind" | "charged">): string | null {
  const kind = inputKindLabel(s.inputKind);
  return kind && s.inputKind === "barcode" && !s.charged ? `${kind} · free` : kind;
}
