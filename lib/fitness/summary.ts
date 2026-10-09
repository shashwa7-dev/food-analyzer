// Pure display helpers for the saved workout summary (spec §C screen 3, mock-c1 Fitness "Finished").
import { addDays, SHORT_MONTHS, todayIn } from "@/lib/dates";
import type { WorkoutExercise } from "@/lib/fitness/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "62.5", "60": at most two decimals, no trailing zeros. */
export const fmtKg = (n: number) => String(Math.round(n * 100) / 100);

/** "18:10", the 24-hour wall time at `at` in `tz`. */
function clock(at: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
}

/** "Today", "Yesterday", "Mon, 5 Oct" (or "Mon, 5 Oct 2025" in another year) for a YYYY-MM-DD day. */
function dayLabel(day: string, today: string): string {
  if (day === today) return "Today";
  if (day === addDays(today, -1)) return "Yesterday";
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const year = day.slice(0, 4) === today.slice(0, 4) ? "" : ` ${y}`;
  return `${weekday}, ${d} ${SHORT_MONTHS[m - 1]}${year}`;
}

/**
 * "Today · 18:10 – 18:58": the start day and the start–end wall times in the user's timezone, the end
 * being startedAt + durationMin. A zero-minute workout shows the start time alone.
 */
export function workoutWhen(startedAt: string, durationMin: number, tz: string, now: Date = new Date()): string {
  const start = new Date(startedAt);
  const day = dayLabel(todayIn(tz, start), todayIn(tz, now));
  if (durationMin <= 0) return `${day} · ${clock(start, tz)}`;
  const end = new Date(start.getTime() + durationMin * 60_000);
  return `${day} · ${clock(start, tz)} – ${clock(end, tz)}`;
}

/**
 * An exercise row's muted line: "3 × 62.5 kg" (done sets × the heaviest done weight), plus
 * " · best 62.5 × 8" when the best set is a PR; "3 sets" when no done set has a weight; "No sets done".
 */
export function exerciseSummary(e: Pick<WorkoutExercise, "sets" | "best" | "pr">): string {
  const done = e.sets.filter((s) => s.done);
  if (!done.length) return "No sets done";
  const weights = done.map((s) => s.weightKg).filter((w): w is number => w !== null && w > 0);
  const head = weights.length ? `${done.length} × ${fmtKg(Math.max(...weights))} kg` : `${done.length} ${done.length === 1 ? "set" : "sets"}`;
  return e.pr && e.best ? `${head} · best ${fmtKg(e.best.weightKg)} × ${e.best.reps}` : head;
}
