import type { ProgressSummary, Range } from "./aggregate";

export const AXIS_LABEL: Record<keyof ProgressSummary["balance"], string> = {
  protein: "Protein", fibre: "Fibre", energy: "Calories", sugars: "Sugar", sodium: "Sodium", satFat: "Sat fat",
};

const period = (r: Range) => (r === "week" ? "this week" : "this month");

/**
 * The line under the nutrient-balance radar. A limit over on the known values says so; otherwise a
 * limit some entries have no value for is "incomplete", never "within your limits".
 */
export function balanceTakeaway(s: Pick<ProgressSummary, "worstOverLimit" | "range" | "incomplete">): string {
  const w = s.worstOverLimit;
  if (w) return `${AXIS_LABEL[w.axis]} is ${w.pct - 100}% over your limit ${period(s.range)}.`;
  if (s.incomplete.length) {
    const names = s.incomplete.map((a, i) => (i === 0 ? AXIS_LABEL[a] : AXIS_LABEL[a].toLowerCase()));
    const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
    return `${list} data is incomplete ${period(s.range)}.`;
  }
  return `Everything within your limits ${period(s.range)}.`;
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

/** Thousands with commas (en-IN, as Today uses), deterministic on server and client. */
export const grouped = (n: number) => Math.round(n).toLocaleString("en-IN");
