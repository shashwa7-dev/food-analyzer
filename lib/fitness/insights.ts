// Pure derived values for the Workouts hub (spec "The /workouts page" and "Pro gating"). Inputs are
// plain rows the service loads (visible workouts, done sets); nothing here touches the database.
import { addDays } from "@/lib/dates";
import { bestSet, isPr, weekBounds } from "@/lib/fitness/stats";
import type { BestSet, Preset, WorkoutKind } from "@/lib/fitness/types";

export type StatsRange = "week" | "month";
/** The calendar, legend and "How often" order. `custom` is an Empty session (gym, no preset). */
export const DAY_TYPES = ["push", "pull", "legs", "back", "shoulders", "custom", "activity"] as const;
export type DayType = (typeof DAY_TYPES)[number];

export type InsightWorkout = {
  id: string; date: string; kind: WorkoutKind; preset: Preset | null; startedAt: string;
  durationMin: number; kcalBurned: number; kcalEstimated: boolean; volumeKg: number;
};
/** One done set of a visible workout. */
export type InsightSet = {
  workoutId: string; date: string; startedAt: string; createdAt: string; exerciseKey: string; name: string;
  weightKg: number | null; reps: number | null;
};
export type Period = { start: string; end: string; prevStart: string; prevEnd: string };

const round1 = (x: number) => Math.round(x * 10) / 10;
const round2 = (x: number) => Math.round(x * 100) / 100;
const pad2 = (x: number) => String(x).padStart(2, "0");
/** Days in month `m` (1–12) of year `y`. */
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const within = (d: string, a: string, b: string) => d >= a && d <= b;

/** Week: Monday to today vs the same span last week. Month: the 1st to today vs the previous month's same days (clamped). */
export function periodBounds(range: StatsRange, today: string): Period {
  if (range === "week") {
    const { start } = weekBounds(today);
    return { start, end: today, prevStart: addDays(start, -7), prevEnd: addDays(today, -7) };
  }
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  const prefix = `${py}-${pad2(pm)}`;
  return { start: `${today.slice(0, 7)}-01`, end: today, prevStart: `${prefix}-01`, prevEnd: `${prefix}-${pad2(Math.min(d, daysInMonth(py, pm)))}` };
}

export function workoutType(w: Pick<InsightWorkout, "kind" | "preset">): DayType {
  return w.kind === "activity" ? "activity" : (w.preset ?? "custom");
}

/** A day's colour: its first gym session's type, else activity; null for a rest day. */
export function dayType(ws: Pick<InsightWorkout, "kind" | "preset" | "startedAt">[]): DayType | null {
  if (!ws.length) return null;
  const gym = ws.filter((w) => w.kind === "gym").sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  return gym.length ? workoutType(gym[0]!) : "activity";
}

export type CalendarDay = { date: string; type: DayType | null; isToday: boolean; isFuture: boolean };
export type MonthCalendar = { month: string; leadingBlanks: number; days: CalendarDay[]; workoutDays: number };

/** The current calendar month, Monday first. */
export function monthCalendar(workouts: InsightWorkout[], today: string): MonthCalendar {
  const month = today.slice(0, 7);
  const [y, m] = month.split("-").map(Number) as [number, number];
  const first = `${month}-01`;
  const byDate = new Map<string, InsightWorkout[]>();
  for (const w of workouts) if (w.date.startsWith(month)) byDate.set(w.date, [...(byDate.get(w.date) ?? []), w]);
  const days = Array.from({ length: daysInMonth(y, m) }, (_, i) => {
    const date = addDays(first, i);
    return { date, type: dayType(byDate.get(date) ?? []), isToday: date === today, isFuture: date > today };
  });
  return { month, leadingBlanks: (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7, days, workoutDays: days.filter((d) => d.type !== null).length };
}

export type AxisBounds = { min: number; max: number; ticks: [number, number, number] };

function niceStep(x: number): number {
  const mag = 10 ** Math.floor(Math.log10(x));
  for (const f of [1, 2, 5, 10]) if (f * mag >= x) return f * mag;
  return 10 * mag;
}

/** A y-axis fitted to the data (10% padding, round steps, never below 0); at least `minSpan` tall. */
export function niceBounds(values: number[], minSpan = 1000): AxisBounds {
  let lo = values.length ? Math.min(...values) : 0;
  let hi = values.length ? Math.max(...values) : 0;
  if (hi - lo < minSpan) {
    const mid = (hi + lo) / 2;
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
  }
  const pad = (hi - lo) * 0.1;
  const step = niceStep((hi - lo + 2 * pad) / 2);
  const min = Math.max(0, Math.floor((lo - pad) / step) * step);
  const max = Math.ceil((hi + pad) / step) * step;
  return { min, max, ticks: [min, (min + max) / 2, max] };
}

export type VolumeWeek = { start: string; kg: number };
export type VolumeWeeks = { weeks: VolumeWeek[]; current: number; deltaVsLast: number; best: number; avg: number; trendPct: number | null; axis: AxisBounds };

/** Volume per Monday–Sunday week for the `count` weeks ending this one, oldest first. */
export function volumeWeeks(workouts: InsightWorkout[], today: string, count = 8): VolumeWeeks {
  const monday = weekBounds(today).start;
  const weeks = Array.from({ length: count }, (_, i) => {
    const start = addDays(monday, -7 * (count - 1 - i));
    const end = addDays(start, 6);
    return { start, kg: round2(workouts.filter((w) => within(w.date, start, end)).reduce((t, w) => t + w.volumeKg, 0)) };
  });
  const kgs = weeks.map((x) => x.kg);
  const current = kgs.at(-1) ?? 0;
  const first = kgs[0] ?? 0;
  const lastCompleted = kgs.at(-2) ?? 0;
  // Same span as the Volume tile: last Monday through the same weekday last week.
  const lastSoFar = round2(workouts.filter((w) => within(w.date, addDays(monday, -7), addDays(today, -7))).reduce((t, w) => t + w.volumeKg, 0));
  return {
    weeks, current, deltaVsLast: round2(current - lastSoFar), best: Math.max(0, ...kgs),
    avg: round2(kgs.reduce((t, k) => t + k, 0) / Math.max(1, kgs.length)),
    trendPct: first > 0 ? Math.round(((lastCompleted - first) / first) * 100) : null,
    axis: niceBounds(kgs),
  };
}

const chrono = (a: Pick<InsightSet, "date" | "startedAt" | "createdAt">, b: Pick<InsightSet, "date" | "startedAt" | "createdAt">) =>
  a.date.localeCompare(b.date) || a.startedAt.localeCompare(b.startedAt) || a.createdAt.localeCompare(b.createdAt);

/** Workout × exercise pairs that set a PR: their best set beats every earlier workout's best (a first time and ties don't). */
export function prEvents(sets: InsightSet[]): { workoutId: string; date: string; exerciseKey: string }[] {
  const groups = new Map<string, InsightSet[]>();
  for (const s of sets) {
    const k = `${s.workoutId}|${s.exerciseKey}`;
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  const bests = [...groups.values()]
    .map((g) => ({ head: g[0]!, best: bestSet(g.map((s) => ({ weightKg: s.weightKg, reps: s.reps, done: true }))) }))
    .filter((x): x is { head: InsightSet; best: BestSet } => x.best !== null)
    .sort((a, b) => chrono(a.head, b.head));
  const top = new Map<string, number>();
  const out: { workoutId: string; date: string; exerciseKey: string }[] = [];
  for (const { head, best } of bests) {
    const before = top.get(head.exerciseKey) ?? null;
    if (isPr(before, { weightKg: best.weightKg, reps: best.reps, done: true })) out.push({ workoutId: head.workoutId, date: head.date, exerciseKey: head.exerciseKey });
    if (before === null || best.e1rm > before) top.set(head.exerciseKey, best.e1rm);
  }
  return out;
}

export type TopExercise = {
  exerciseKey: string; name: string; sets: number; sessions: number; best: BestSet | null;
  e1rm: number | null; e1rmDelta: number | null; spark: (number | null)[];
};

/** The `n` exercises with the most done sets in the period (ties: more volume, then name), with an 8-week e1RM sparkline. */
export function topExercises(sets: InsightSet[], p: Period, today: string, n = 3): TopExercise[] {
  const asSet = (s: InsightSet) => ({ weightKg: s.weightKg, reps: s.reps, done: true });
  const vol = (ss: InsightSet[]) => ss.reduce((t, s) => t + (s.weightKg ?? 0) * (s.reps ?? 0), 0);
  const groups = new Map<string, InsightSet[]>();
  for (const s of [...sets].sort(chrono)) if (within(s.date, p.start, p.end)) groups.set(s.exerciseKey, [...(groups.get(s.exerciseKey) ?? []), s]);
  const monday = weekBounds(today).start;
  return [...groups.entries()]
    .map(([key, ss]) => ({ key, ss, name: ss.at(-1)!.name, volume: vol(ss) }))
    .sort((a, b) => b.ss.length - a.ss.length || b.volume - a.volume || a.name.localeCompare(b.name))
    .slice(0, n)
    .map(({ key, ss, name }) => {
      const best = bestSet(ss.map(asSet));
      const prev = bestSet(sets.filter((s) => s.exerciseKey === key && within(s.date, p.prevStart, p.prevEnd)).map(asSet));
      const spark = Array.from({ length: 8 }, (_, i) => {
        const start = addDays(monday, -7 * (7 - i));
        const b = bestSet(sets.filter((s) => s.exerciseKey === key && within(s.date, start, addDays(start, 6))).map(asSet));
        return b ? round1(b.e1rm) : null;
      });
      return {
        exerciseKey: key, name, sets: ss.length, sessions: new Set(ss.map((s) => s.workoutId)).size, best,
        e1rm: best ? round1(best.e1rm) : null, e1rmDelta: best && prev ? round1(best.e1rm - prev.e1rm) : null, spark,
      };
    });
}

export type TypeCount = { type: DayType; sessions: number };

/** Sessions per type in `start`–`end`, in DAY_TYPES order, zeros left out. */
export function byType(workouts: InsightWorkout[], start: string, end: string): TypeCount[] {
  const counts = new Map<DayType, number>();
  for (const w of workouts) if (within(w.date, start, end)) counts.set(workoutType(w), (counts.get(workoutType(w)) ?? 0) + 1);
  return DAY_TYPES.filter((t) => counts.has(t)).map((type) => ({ type, sessions: counts.get(type)! }));
}

export type Delta = { value: number; prev: number; delta: number };
export type PeriodTiles = { workoutDays: Delta; minutes: Delta; kcal: Delta; kcalEstimated: boolean; volumeKg: Delta; prs: Delta };

const delta = (value: number, prev: number): Delta => ({ value: round2(value), prev: round2(prev), delta: round2(value - prev) });

export function periodTiles(workouts: InsightWorkout[], prs: { date: string; workoutId?: string; exerciseKey?: string }[], p: Period): PeriodTiles {
  const cur = workouts.filter((w) => within(w.date, p.start, p.end));
  const prev = workouts.filter((w) => within(w.date, p.prevStart, p.prevEnd));
  const sum = (ws: InsightWorkout[], f: (w: InsightWorkout) => number) => ws.reduce((t, w) => t + f(w), 0);
  const days = (ws: InsightWorkout[]) => new Set(ws.map((w) => w.date)).size;
  const prIn = (a: string, b: string) => prs.filter((x) => within(x.date, a, b)).length;
  return {
    workoutDays: delta(days(cur), days(prev)),
    minutes: delta(sum(cur, (w) => w.durationMin), sum(prev, (w) => w.durationMin)),
    kcal: delta(sum(cur, (w) => w.kcalBurned), sum(prev, (w) => w.kcalBurned)),
    kcalEstimated: cur.some((w) => w.kcalEstimated),
    volumeKg: delta(sum(cur, (w) => w.volumeKg), sum(prev, (w) => w.volumeKg)),
    prs: delta(prIn(p.start, p.end), prIn(p.prevStart, p.prevEnd)),
  };
}

/** Consecutive Monday–Sunday weeks with at least `goal` training days, counting back from this week if met, else from last week. */
export function goalStreak(workouts: Pick<InsightWorkout, "date">[], today: string, goal: number): number {
  const trained = new Set(workouts.map((w) => w.date));
  const daysIn = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i)).filter((d) => trained.has(d)).length;
  let monday = weekBounds(today).start;
  if (daysIn(monday) < goal) monday = addDays(monday, -7);
  let streak = 0;
  while (streak < 520 && daysIn(monday) >= goal) {
    streak++;
    monday = addDays(monday, -7);
  }
  return streak;
}

/** GET /api/v1/fitness/stats. The Pro fields are null when `locked`. */
export type FitnessStats = {
  range: StatsRange; today: string; period: Period; hasWorkouts: boolean; locked: boolean;
  tiles: PeriodTiles; goalStreak: number;
  calendar: MonthCalendar | null; volume: VolumeWeeks | null; topExercises: TopExercise[] | null; byType: TypeCount[] | null;
};

export function buildStats(i: { range: StatsRange; today: string; goal: number; workouts: InsightWorkout[]; sets: InsightSet[]; locked: boolean }): FitnessStats {
  const period = periodBounds(i.range, i.today);
  const prs = prEvents(i.sets);
  return {
    range: i.range, today: i.today, period, hasWorkouts: i.workouts.length > 0, locked: i.locked,
    tiles: periodTiles(i.workouts, prs, period), goalStreak: goalStreak(i.workouts, i.today, i.goal),
    calendar: i.locked ? null : monthCalendar(i.workouts, i.today),
    volume: i.locked ? null : volumeWeeks(i.workouts, i.today),
    topExercises: i.locked ? null : topExercises(i.sets, period, i.today),
    byType: i.locked ? null : byType(i.workouts, period.start, period.end),
  };
}
