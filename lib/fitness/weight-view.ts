// Pure display helpers for body weight (spec §C screens 6–7): the 30-day trend, the change and the axis.
import { addDays } from "@/lib/dates";
import type { WeightEntry } from "@/lib/fitness/types";

/** "72.4", "70": one decimal at most. */
export const fmtWeight = (kg: number) => String(Math.round(kg * 10) / 10);

/** "−1.4 kg", "+0.3 kg", "No change" (a true minus sign); null stays null. */
export function fmtChange(change: number | null): string | null {
  if (change === null) return null;
  const r = Math.round(change * 10) / 10;
  if (r === 0) return "No change";
  return `${r < 0 ? "−" : "+"}${fmtWeight(Math.abs(r))} kg`;
}

/** The entries of the `days` days ending at the newest entry, oldest first (the chart's order). */
export function trendPoints(entries: WeightEntry[], days = 30): WeightEntry[] {
  if (!entries.length) return [];
  const newest = entries.reduce((a, b) => (b.date > a.date ? b : a)).date;
  const from = addDays(newest, -(days - 1));
  return entries.filter((e) => e.date >= from).sort((a, b) => a.date.localeCompare(b.date));
}

/** A y-axis covering every point and the goal, padded and snapped to whole kg, with 3–5 whole ticks. */
export function weightAxis(values: number[], goal: number | null): { min: number; max: number; ticks: number[] } {
  const all = goal === null ? values : [...values, goal];
  if (!all.length) return { min: 0, max: 1, ticks: [0, 1] };
  const min = Math.floor(Math.min(...all) - 0.5);
  let max = Math.ceil(Math.max(...all) + 0.5);
  if (max - min < 2) max = min + 2;
  const step = Math.max(1, Math.ceil((max - min) / 4));
  max = min + Math.ceil((max - min) / step) * step;
  const ticks: number[] = [];
  for (let t = min; t <= max; t += step) ticks.push(t);
  return { min, max, ticks };
}
