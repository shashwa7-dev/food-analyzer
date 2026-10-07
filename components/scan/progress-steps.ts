// The Analysing card's steps (spec §6.10). The server only reports queued/processing/done, so the
// steps are cosmetic: analysingStep (lib/scans/modes) picks the current one on a timer.

export const SCAN_STEPS = [
  "Reading the nutrition table",
  "Matching ingredients and allergens",
  "Grading for your goals",
  "Finding better options",
] as const;

export type StepState = "done" | "active" | "wait";

export function stepState(index: number, current: number): StepState {
  return index < current ? "done" : index === current ? "active" : "wait";
}

/** Past the server's 60 s maxDuration the job is likely dead; the stuck sweep will fail (and refund) it. */
export const SLOW_AFTER_MS = 65_000;

/**
 * Whether to show "Still working": timed from the scan's own `createdAt` (N10), so reopening a scan
 * that has been running for a while says so at once; before the first poll lands, from `fallbackStart`.
 */
export function isSlow(createdAt: string | undefined, fallbackStart: number, now: number): boolean {
  const started = createdAt ? Date.parse(createdAt) : NaN;
  return now - (Number.isFinite(started) ? started : fallbackStart) > SLOW_AFTER_MS;
}
