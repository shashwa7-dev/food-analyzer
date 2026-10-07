import { addDays } from "@/lib/dates";
import type { DailyTargets, Goal, Grade } from "@/lib/nutrition/types";

/** One calendar day (in the user's timezone) of logged food, summed from `food_log.nutrients` snapshots. */
export interface DayAgg {
  date: string;
  kcal: number; protein: number; carbs: number; fat: number; fibre: number; sugars: number; sodiumMg: number; satFat: number;
  entries: number;
  /** kcal per grade snapshot; ungraded entries are left out. */
  gradeKcal: Partial<Record<Grade, number>>;
}
export type Range = "week" | "month";
export type LimitAxis = "sugars" | "sodium" | "satFat";
export interface ProgressSummary {
  range: Range;
  /** Every day of the range, oldest first; days without entries are zero rows. */
  days: DayAgg[];
  targets: DailyTargets;
  kpis: { avgKcal: number; avgProtein: number; daysOnTarget: number; daysLogged: number; streak: number };
  /** % of kcal from each macro (protein×4, carbs×4, fat×9); sums to 100, or all 0. */
  macroSplit: { protein: number; carbs: number; fat: number };
  /** % of target (protein, fibre, energy) or of limit (sugars, sodium, satFat), averaged over logged days, capped at 150. */
  balance: { protein: number; fibre: number; energy: number; sugars: number; sodium: number; satFat: number };
  /** % of graded kcal per grade; sums to 100, or all 0. */
  gradeMix: Record<Grade, number>;
  /** The limit furthest over 100% (uncapped pct), or null when every limit is within. */
  worstOverLimit: { axis: LimitAxis; pct: number } | null;
}

export const GRADES: Grade[] = ["A", "B", "C", "D", "E"];
export const RANGES = ["week", "month"] as const;
export const rangeDays = (r: Range) => (r === "week" ? 7 : 30);
/** Balance values are capped here so one wild day can't flatten the radar. */
export const BALANCE_CAP = 150;

type Summed = Exclude<keyof DayAgg, "date" | "entries" | "gradeKcal">;

const emptyDay = (date: string): DayAgg => ({ date, kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, sugars: 0, sodiumMg: 0, satFat: 0, entries: 0, gradeKcal: {} });
const pct = (v: number, t: number) => (t > 0 ? Math.round((v / t) * 100) : 0);

/** The share of the calorie target that counts as "on target" for this goal. */
export function onTargetRange(goal: Goal): [number, number] {
  return goal === "weight_loss" ? [0.8, 1.0] : [0.9, 1.1];
}

/** Consecutive days with entries ending today — or ending yesterday when today has nothing yet. */
export function streakEnding(datesWithEntries: Set<string>, today: string): number {
  let d = datesWithEntries.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (datesWithEntries.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** Integer percentages of `parts` summing to exactly 100 (largest remainder); all zeros when the total is 0. */
export function roundTo100(parts: number[]): number[] {
  const total = parts.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return parts.map(() => 0);
  const raw = parts.map((p) => (p / total) * 100);
  const out = raw.map(Math.floor);
  let rest = 100 - out.reduce((a, b) => a + b, 0);
  const byRemainder = raw.map((r, i) => [r - out[i]!, i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of byRemainder) {
    if (rest-- <= 0) break;
    out[i]!++;
  }
  return out;
}

/**
 * Turns per-day rows into the Progress summary for the `range` ending on `today`.
 * Averages are over days with entries only. `streakDates` (dates with entries reaching further
 * back than the range) lets the streak run past the window; without it the streak uses `rows`.
 */
export function summarize(rows: DayAgg[], targets: DailyTargets, goal: Goal, today: string, range: Range, streakDates?: Iterable<string>): ProgressSummary {
  const n = rangeDays(range);
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const days = Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - (n - 1));
    return byDate.get(date) ?? emptyDay(date);
  });
  const logged = days.filter((d) => d.entries > 0);
  const L = logged.length;
  const avg = (k: Summed) => (L ? logged.reduce((a, d) => a + d[k], 0) / L : 0);

  const [lo, hi] = onTargetRange(goal);
  const daysOnTarget = logged.filter((d) => d.kcal >= targets.energyKcal * lo && d.kcal <= targets.energyKcal * hi).length;

  const [protein, carbs, fat] = roundTo100([avg("protein") * 4, avg("carbs") * 4, avg("fat") * 9]) as [number, number, number];

  const raw = {
    protein: pct(avg("protein"), targets.protein),
    fibre: pct(avg("fibre"), targets.fibre),
    energy: pct(avg("kcal"), targets.energyKcal),
    sugars: pct(avg("sugars"), targets.sugarsMax),
    sodium: pct(avg("sodiumMg"), targets.sodiumMgMax),
    satFat: pct(avg("satFat"), targets.satFatMax),
  };
  const balance = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Math.min(BALANCE_CAP, v)])) as ProgressSummary["balance"];
  const over = (["sugars", "sodium", "satFat"] as const).filter((k) => raw[k] > 100).sort((a, b) => raw[b] - raw[a]);

  const mix = roundTo100(GRADES.map((g) => logged.reduce((a, d) => a + (d.gradeKcal[g] ?? 0), 0)));
  const streakSet = new Set(streakDates ?? rows.filter((r) => r.entries > 0).map((r) => r.date));

  return {
    range, days, targets,
    kpis: { avgKcal: Math.round(avg("kcal")), avgProtein: Math.round(avg("protein")), daysOnTarget, daysLogged: L, streak: streakEnding(streakSet, today) },
    macroSplit: { protein, carbs, fat },
    balance,
    gradeMix: Object.fromEntries(GRADES.map((g, i) => [g, mix[i]!])) as Record<Grade, number>,
    worstOverLimit: over.length ? { axis: over[0]!, pct: raw[over[0]!] } : null,
  };
}
