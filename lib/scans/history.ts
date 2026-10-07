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
