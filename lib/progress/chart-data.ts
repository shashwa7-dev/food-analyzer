import { toneFor } from "@/lib/today/tone";
import type { DayAgg, ProgressSummary } from "./aggregate";

/** A bar on the calories chart. `over` matches Today's over-target signal: strictly above the target. */
export type CalorieBar = { date: string; kcal: number; over: boolean; isToday: boolean; logged: boolean };

export function calorieBars(days: DayAgg[], target: number, today: string): CalorieBar[] {
  return days.map((d) => ({
    date: d.date,
    kcal: Math.round(d.kcal),
    over: d.entries > 0 && toneFor(d.kcal, target) === "over",
    isToday: d.date === today,
    logged: d.entries > 0,
  }));
}

/** A point on the sodium line; days with nothing logged are gaps (null), not zero. */
export type SodiumPoint = { date: string; sodium: number | null; over: boolean; isMax: boolean };

export function sodiumPoints(days: DayAgg[], limit: number): SodiumPoint[] {
  const values = days.map((d) => (d.entries > 0 ? Math.round(d.sodiumMg) : null));
  let maxAt = -1;
  values.forEach((v, i) => {
    if (v !== null && v > 0 && (maxAt < 0 || v > values[maxAt]!)) maxAt = i;
  });
  return days.map((d, i) => ({ date: d.date, sodium: values[i]!, over: values[i] !== null && values[i]! > limit, isMax: i === maxAt }));
}

const NICE_STEPS = [50, 100, 250, 500, 1000, 1500, 2000, 2500, 5000, 10000] as const;

/**
 * A y-axis that clears both the data and the reference line with ~10% headroom (room for the
 * line's label), and round ticks from 0 below the top — two to four of them, as in the mock.
 */
export function niceAxis(maxValue: number, reference: number): { max: number; ticks: number[] } {
  const max = Math.max(maxValue, reference, 1) * 1.1;
  const raw = max / 2.5;
  const step = [...NICE_STEPS].reverse().find((s) => s <= raw) ?? NICE_STEPS[0];
  const ticks: number[] = [];
  for (let t = 0; t <= max; t += step) ticks.push(t);
  return { max, ticks };
}
/** Which dates get an x-axis label: every day for a week; for a month, today and every 7th day back. */
export function labelledDates(days: { date: string }[]): string[] {
  if (days.length <= 7) return days.map((d) => d.date);
  return days.filter((_, i) => (days.length - 1 - i) % 7 === 0).map((d) => d.date);
}

/** The radar rows, in the mock's clockwise order from the top. */
export const BALANCE_ORDER = ["protein", "fibre", "energy", "sugars", "sodium", "satFat"] as const;

export function balanceRows(balance: ProgressSummary["balance"]) {
  return BALANCE_ORDER.map((key) => ({ key, value: balance[key], over: (key === "sugars" || key === "sodium" || key === "satFat") && balance[key] > 100 }));
}

/**
 * Which end of a reference line its label should sit on. A label just above the line collides with
 * points at ≥ 90% of the reference; one just below it with points between 60% and 110%. Counts those
 * in each outer third and picks the emptier end; a tie keeps `prefer` (the mock's side).
 */
export function labelSide(values: (number | null)[], reference: number, opts: { prefer: "left" | "right"; below?: boolean }): "left" | "right" {
  const third = Math.max(1, Math.ceil(values.length / 3));
  const collides = (v: number) => (opts.below ? v >= reference * 0.6 && v <= reference * 1.1 : v >= reference * 0.9);
  const hits = (vs: (number | null)[]) => vs.filter((v) => v !== null && collides(v)).length;
  const left = hits(values.slice(0, third));
  const right = hits(values.slice(-third));
  if (left === right) return opts.prefer;
  return left < right ? "left" : "right";
}
