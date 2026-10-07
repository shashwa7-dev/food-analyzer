// One fixed, user-safe sentence (with the recovery action) per scan error code — used by the API and
// reused by the scan UI. Pure: no imports, safe in client bundles.

export const SCAN_ERROR_CODES = [
  "NO_CREDITS", "RATE_LIMITED", "DAILY_LIMIT", "SERVICE_BUSY", "BARCODE_NOT_FOUND", "UNREADABLE_IMAGE",
  "NOT_FOOD", "MODEL_ERROR", "TIMEOUT", "INVALID_INPUT", "TOO_LARGE", "CONFLICT",
] as const;
export type ScanErrorCode = (typeof SCAN_ERROR_CODES)[number];

export const SCAN_MESSAGES: Record<ScanErrorCode, string> = {
  NO_CREDITS: "You've used this month's AI scans. Barcode scans are still free.",
  RATE_LIMITED: "Too many scans — wait a minute.",
  DAILY_LIMIT: "You've reached today's limit of AI scans. Try again tomorrow — barcode scans are still free.",
  SERVICE_BUSY: "Scanning is busy right now. Try again later — barcode scans still work.",
  BARCODE_NOT_FOUND: "We don't know this barcode yet — add a photo of the nutrition label.",
  UNREADABLE_IMAGE: "Couldn't read the photo. Try again with the label in focus and well lit.",
  NOT_FOOD: "That doesn't look like food. Try a photo of the label or your plate.",
  MODEL_ERROR: "The scan couldn't be completed. Please try again.",
  TIMEOUT: "The scan took too long and timed out. Please try again.",
  INVALID_INPUT: "Add 1 to 3 photos (JPEG, PNG or WebP) or a valid barcode.",
  TOO_LARGE: "Those photos are too large — keep each under 1.2 MB and send at most 3.",
  /** Idempotency-Key replay of a scan the user has since deleted. */
  CONFLICT: "That scan was deleted.",
};

/** SERVICE_BUSY variant when GOOGLE_GENERATIVE_AI_API_KEY is not configured. */
export const NOT_CONFIGURED_MESSAGE = "Scanning isn't set up yet.";
/** Appended to every failure after a charge (spec §8: post-charge failures always say this). */
export const REFUNDED_MESSAGE = "Your credit was refunded.";

export function isScanErrorCode(code: string): code is ScanErrorCode {
  return (SCAN_ERROR_CODES as readonly string[]).includes(code);
}

/**
 * The sentence for a stored scan error. `specific` is the engine's own (already user-safe, fixed)
 * sentence when it carries more than the code does (e.g. "We don't know this product yet — add a
 * photo of the nutrition label." under UNREADABLE_IMAGE); it wins over the code's generic sentence.
 */
export function scanErrorMessage(code: string, opts: { specific?: string | null; refunded?: boolean } = {}): string {
  const base = opts.specific || (isScanErrorCode(code) ? SCAN_MESSAGES[code] : SCAN_MESSAGES.MODEL_ERROR);
  return opts.refunded ? `${base} ${REFUNDED_MESSAGE}` : base;
}

/**
 * The one recovery action the scan UI offers next to a code's sentence. `credits` links to the
 * credits page, `photo` goes back to the camera keeping the barcode, `retry` re-sends the same
 * photos, `rescan` starts over; null means the sentence alone says what to do (wait, come back tomorrow).
 */
export type ScanAction = { kind: "credits" | "photo" | "retry" | "rescan"; label: string };

const CREDITS: ScanAction = { kind: "credits", label: "See your AI scans" };
const PHOTO: ScanAction = { kind: "photo", label: "Take a photo of the label" };
const RETRY: ScanAction = { kind: "retry", label: "Try again" };
const RESCAN: ScanAction = { kind: "rescan", label: "Scan again" };

export const SCAN_ACTIONS: Record<ScanErrorCode, ScanAction | null> = {
  NO_CREDITS: CREDITS,
  RATE_LIMITED: null,
  DAILY_LIMIT: null,
  SERVICE_BUSY: RETRY,
  BARCODE_NOT_FOUND: PHOTO,
  UNREADABLE_IMAGE: RESCAN,
  NOT_FOOD: RESCAN,
  MODEL_ERROR: RESCAN,
  TIMEOUT: RESCAN,
  INVALID_INPUT: RESCAN,
  TOO_LARGE: RESCAN,
  CONFLICT: RESCAN,
};

/** The action for a code from the API or a stored scan; an unknown code gets MODEL_ERROR's. */
export function scanErrorAction(code: string): ScanAction | null {
  return isScanErrorCode(code) ? SCAN_ACTIONS[code] : SCAN_ACTIONS.MODEL_ERROR;
}
