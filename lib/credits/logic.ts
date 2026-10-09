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

export type Balance = { credits: number; allowance: number; periodResetsAt: Date };
/** The profile columns a balance is read from. */
export type BalanceRow = { plan: PlanKey; credits: number; allowancePeriod: string | null };

/**
 * The balance straight off a profile row, or null when the row first has to roll into the current
 * period (never granted, or an earlier month): the same test the reset uses, so a read that needs
 * no reset needs no transaction either.
 */
export function balanceIfCurrent(row: BalanceRow, now: Date): Balance | null {
  if (row.allowancePeriod === null || currentPeriod(now) > row.allowancePeriod) return null;
  return { credits: row.credits, allowance: allowanceFor(row.plan), periodResetsAt: nextPeriodStart(now) };
}
