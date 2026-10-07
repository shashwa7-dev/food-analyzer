import type { LimitAxis, ProgressSummary, Range } from "./aggregate";

export const AXIS_LABEL: Record<keyof ProgressSummary["balance"], string> = {
  protein: "Protein", fibre: "Fibre", energy: "Calories", sugars: "Sugar", sodium: "Sodium", satFat: "Sat fat",
};
export const LIMIT_AXES: readonly LimitAxis[] = ["sugars", "sodium", "satFat"];

const period = (r: Range) => (r === "week" ? "this week" : "this month");

/** The line under the nutrient-balance radar. */
export function balanceTakeaway(s: Pick<ProgressSummary, "worstOverLimit" | "range">): string {
  const w = s.worstOverLimit;
  if (!w) return `Everything within your limits ${period(s.range)}.`;
  return `${AXIS_LABEL[w.axis]} is ${w.pct - 100}% over your limit ${period(s.range)}.`;
}

/** The line under the food-quality donut, or null when nothing logged was graded. */
export function gradeTakeaway(mix: ProgressSummary["gradeMix"]): string | null {
  const total = mix.A + mix.B + mix.C + mix.D + mix.E;
  if (total === 0) return null;
  return `${mix.A + mix.B}% of your calories came from A and B foods.`;
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const utc = (date: string) => new Date(`${date}T00:00:00Z`);

/** "Mon" for a YYYY-MM-DD, independent of the host timezone. */
export const weekdayShort = (date: string) => WEEKDAY_SHORT[utc(date).getUTCDay()]!;
/** "M" for a YYYY-MM-DD. */
export const weekdayLetter = (date: string) => weekdayShort(date)[0]!;
/** "7 Oct" for a YYYY-MM-DD. */
export const dayMonth = (date: string) => `${utc(date).getUTCDate()} ${MONTH_SHORT[utc(date).getUTCMonth()]}`;

/** Compact axis number: 0, 500, 1k, 1.5k, 2k. */
export function compact(n: number): string {
  if (Math.abs(n) < 1000) return String(Math.round(n));
  const k = n / 1000;
  return `${Number.isInteger(k) ? k : k.toFixed(1).replace(/\.0$/, "")}k`;
}

/** Thousands with commas, en-GB, deterministic on server and client. */
export const grouped = (n: number) => Math.round(n).toLocaleString("en-GB");
