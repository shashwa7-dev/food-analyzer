import { todayIn } from "@/lib/dates";
export type CreditsState = "ok" | "low" | "empty";
export function creditsState(credits: number): CreditsState {
  if (credits <= 0) return "empty";
  return credits <= 3 ? "low" : "ok";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "1 Nov": the calendar day the allowance resets on, in the user's timezone. The reset is 00:00 UTC
 * on the 1st, so west of UTC that's still the evening of the last day ("31 Oct"). Every "resets …"
 * label uses this so the sidebar, Me and credits pages always agree.
 */
export function resetDayLabel(resetsAt: Date, tz: string): string {
  const d = todayIn(tz, resetsAt);
  return `${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
}
