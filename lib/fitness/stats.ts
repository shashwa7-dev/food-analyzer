// Pure derived values for the fitness tracker (spec §C "Derived values"). Only sets marked done count
// toward volume, best sets and PRs.
import { addDays } from "@/lib/dates";
import type { BestSet, Preset, SetLike, WeekDay, WeekSummary, WeightEntry } from "@/lib/fitness/types";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Σ weight × reps over done sets that have both. */
export function volume(sets: SetLike[]): number {
  let total = 0;
  for (const s of sets) if (s.done && s.weightKg !== null && s.reps !== null) total += s.weightKg * s.reps;
  return round2(total);
}

/** Epley estimated one-rep max: weight × (1 + reps / 30). */
export function e1rm(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

/** A set that can be a best set or a PR: done, with a positive weight and reps. */
function rankable(s: SetLike): s is SetLike & { weightKg: number; reps: number } {
  return s.done && s.weightKg !== null && s.reps !== null && s.weightKg > 0 && s.reps > 0;
}

/** The done set with the highest e1RM (the first one on a tie), or null when none has weight and reps. */
export function bestSet(sets: SetLike[]): BestSet | null {
  let best: BestSet | null = null;
  for (const s of sets) {
    if (!rankable(s)) continue;
    const v = e1rm(s.weightKg, s.reps);
    if (!best || v > best.e1rm) best = { weightKg: s.weightKg, reps: s.reps, e1rm: v };
  }
  return best;
}

/**
 * Whether `set` beats `bestSoFar`, the best earlier e1RM for its exercise. With no earlier best there
 * is nothing to beat, so a first-ever session doesn't light up every exercise as a PR.
 */
export function isPr(bestSoFar: number | null, set: SetLike): boolean {
  if (bestSoFar === null || !rankable(set)) return false;
  return e1rm(set.weightKg, set.reps) > bestSoFar + 1e-9;
}

/**
 * The "Previous" column: the sets of `exerciseKey` in the latest workout that had it. `history` is
 * newest first; null when the exercise was never done.
 */
export function previousSets<S extends SetLike>(history: { exercises: { exerciseKey: string; sets: S[] }[] }[], exerciseKey: string): S[] | null {
  for (const w of history) {
    const ex = w.exercises.find((e) => e.exerciseKey === exerciseKey);
    if (ex) return ex.sets;
  }
  return null;
}

/** Push → Pull → Legs → Push; after Back, Shoulders or nothing, Push. */
export function upNext(lastGymPreset: Preset | null): Preset {
  if (lastGymPreset === "push") return "pull";
  if (lastGymPreset === "pull") return "legs";
  return "push";
}

/** The Monday–Sunday week containing `today` (a local YYYY-MM-DD). */
export function weekBounds(today: string): { start: string; end: string } {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const start = addDays(today, -((dow + 6) % 7));
  return { start, end: addDays(start, 6) };
}

const LABELS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * The week strip and totals for the week starting `weekStart` (a Monday). `workouts` may include other
 * weeks; only those dated inside this one count. The goal counts days trained, not sessions.
 */
export function weekSummary(
  workouts: { date: string; durationMin: number; kcalBurned: number; kcalEstimated?: boolean }[],
  weekStart: string,
  todayLocal: string,
  goal: number,
): WeekSummary {
  const end = addDays(weekStart, 6);
  const inWeek = workouts.filter((w) => w.date >= weekStart && w.date <= end);
  const days: WeekDay[] = LABELS.map((label, i) => {
    const date = addDays(weekStart, i);
    const sessions = inWeek.filter((w) => w.date === date).length;
    const trained = sessions > 0;
    const isToday = date === todayLocal;
    const state = trained ? "done" : isToday ? "today" : date > todayLocal ? "future" : "rest";
    return { date, label, sessions, trained, isToday, state };
  });
  const done = days.filter((d) => d.trained).length;
  return {
    start: weekStart, end, days,
    sessions: inWeek.length,
    minutes: inWeek.reduce((n, w) => n + w.durationMin, 0),
    kcal: inWeek.reduce((n, w) => n + w.kcalBurned, 0),
    kcalEstimated: inWeek.some((w) => w.kcalEstimated),
    goal: { target: goal, done, met: done >= goal },
  };
}

/**
 * Weight change over `days` days: the latest entry minus the earliest one in the `days` days ending at
 * it, kg to two decimals. Null with no earlier entry in that window.
 */
export function weightChange(entries: WeightEntry[], days = 30): number | null {
  if (entries.length < 2) return null;
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1]!;
  const from = addDays(latest.date, -days);
  const first = sorted.find((e) => e.date >= from)!;
  return first.date === latest.date ? null : round2(latest.kg - first.kg);
}
