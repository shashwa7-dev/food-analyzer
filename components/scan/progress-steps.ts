// The "Analysing" screen's steps. The server only reports queued/processing/done, so the steps are
// cosmetic: they advance on a timer and stop on the last one until the scan actually finishes.

export const SCAN_STEPS = ["Uploading photos", "Reading the label", "Checking the numbers", "Scoring for you"] as const;

/** Elapsed ms at which each step after the first becomes active. */
export const STEP_STARTS_MS = [1_500, 5_000, 10_000] as const;

/**
 * Index of the active step after `elapsedMs`; never past the last step while running. When `done`,
 * returns SCAN_STEPS.length (every step ticked).
 */
export function activeStep(elapsedMs: number, done: boolean): number {
  if (done) return SCAN_STEPS.length;
  let step = 0;
  for (const start of STEP_STARTS_MS) if (elapsedMs >= start) step++;
  return Math.min(step, SCAN_STEPS.length - 1);
}

export type StepState = "done" | "active" | "wait";

export function stepState(index: number, active: number): StepState {
  return index < active ? "done" : index === active ? "active" : "wait";
}
