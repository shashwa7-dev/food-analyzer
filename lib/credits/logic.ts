import { PLANS, type PlanKey } from "./plans";

/** "YYYY-MM" for the UTC month containing `now`. */
export function currentPeriod(now: Date): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/** UTC midnight on the 1st of the month after `now` (handles year rollover). */
export function nextPeriodStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

/** Monthly AI-scan allowance for a plan. */
export function allowanceFor(plan: PlanKey): number {
  return PLANS[plan].aiScansPerMonth;
}
