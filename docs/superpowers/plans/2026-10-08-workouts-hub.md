# Workouts Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dedicated `/workouts` page that includes:
- a one-time training setup;
- free weekly stats;
- Pro insights: a Calendar | Volume trends card, top exercises, how often, and Month stats.

It also adds a new nav slot, lime workout icons, and the Today Workouts card moved into the main column.

**Architecture:**
- **Stats are pure.** All maths lives in `lib/fitness/insights.ts`. Its inputs are plain workout and set rows, and its output is one `FitnessStats` object. It's unit-tested exhaustively.
- **The service only loads rows.** `lib/fitness/service.ts` loads the rows: every visible workout plus every done set. It calls `buildStats` and applies the Pro lock.
- **Routes and UI.** Routes stay thin. The `/workouts` page is a server component that calls the service directly. Client islands handle the Week | Month and Calendar | Volume switches and history paging.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4 tokens, Drizzle/Postgres, zod 4, vitest (unit + int), puppeteer-core ui:audit.

**Spec:** `docs/superpowers/specs/2026-10-08-workouts-hub-design.md`. It builds on `docs/superpowers/specs/2026-10-08-phase-2-design.md` §B and §C.

## Global Constraints

- Buttons and CTAs are single-line (`whitespace-nowrap`). Use lucide icons generously.
- Dark is the default theme. Every colour comes from tokens in `app/globals.css` and must work in light and dark.
- Workout and activity icon tiles use `IconTile tone="brand"`. The `protein` tone is for nutrition only.
- Day-type colours:

  | Day type | Token |
  |---|---|
  | push | `--brand` |
  | pull | `--protein` |
  | legs | `--warn` |
  | back | `--carbs` |
  | shoulders | `--fat` |
  | activity | `--muted` at 70% |
  | custom (Empty session) | `--brand-deep` at 60% |

  A legend always sits under the calendar.
- Weeks run Monday–Sunday in the user's timezone (`profile.timezone`, via `todayIn`).
- Volume is Σ weight × reps over done sets. Soft-deleted workouts never count anywhere.
- Pro gating goes through `allows(plan, "fitnessInsights")`. With `PRO_GATES_ENFORCED` off (the default), everyone sees everything.
- Every new API route uses `requireApiUser`, and every query is owner-scoped with `visibleWorkoutWhere(userId)`.
- Dev scripts that write data refuse non-local databases (`assertLocalDb`).
- Copy: "Set up your training" / "Your weight makes calorie burn accurate. You can change these anytime in Me." / "Skip for now" / "See your trends with Pro" / "Volume over 8 weeks, your top exercises, the monthly calendar and how often you train each day type."
- Commits end with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push.
- Don't pipe test commands through `grep` or `tail` in a way that hides a failing exit code. Check the exit status.

## Review Focus

1. **Month boundary.** On 31 March, Month compares 1–31 Mar with 1–28/29 Feb. On 1 Jan, the previous period is December of the year before. Pinned in Task 1 (`periodBounds` tests).
2. **A user with workouts but no sets with weight** (only activities, or bodyweight reps). Top exercises still ranks by set count. `best`, `e1rm` and `e1rmDelta` are null, and nothing crashes or shows NaN. Pinned in Task 1 (`topExercises` null-best test).
3. **A Basic user with the gates on asks for Month.** The page falls back to Week with the Pro chip. The API returns 403. The Week response never leaks the Pro fields. Pinned in Task 2 (int test).
4. **A soft-deleted workout.** It must not colour a calendar day, add volume, count as a PR or appear in history. Pinned in Task 2 (int test).
5. **Existing users after migrate.** Anyone with a workout or a weight row never sees the setup. Pinned in Task 2 (backfill int test).

---

### Task 1: Pure insights module

**Files:**
- Create: `lib/fitness/insights.ts`
- Test: `lib/fitness/insights.test.ts`

**Interfaces:**
- Consumes:
  - `addDays(date, n)` from `@/lib/dates`;
  - `bestSet(sets: SetLike[]): BestSet | null`, `isPr(bestSoFar: number | null, set: SetLike): boolean` and `weekBounds(today)` from `@/lib/fitness/stats`;
  - the types `BestSet`, `Preset` and `WorkoutKind` from `@/lib/fitness/types`.
- Produces: every export below. Tasks 2, 4 and 5 rely on these exact names: `StatsRange`, `DAY_TYPES`, `DayType`, `InsightWorkout`, `InsightSet`, `Period`, `periodBounds`, `workoutType`, `dayType`, `MonthCalendar`, `CalendarDay`, `monthCalendar`, `AxisBounds`, `niceBounds`, `VolumeWeek`, `VolumeWeeks`, `volumeWeeks`, `prEvents`, `TopExercise`, `topExercises`, `TypeCount`, `byType`, `Delta`, `PeriodTiles`, `periodTiles`, `goalStreak`, `FitnessStats`, `buildStats`.

- [ ] **Step 1: Write the failing tests** in `lib/fitness/insights.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildStats, byType, dayType, goalStreak, monthCalendar, niceBounds, periodBounds, periodTiles, prEvents, topExercises,
  volumeWeeks, type InsightSet, type InsightWorkout,
} from "./insights";

let n = 0;
const w = (date: string, p: Partial<InsightWorkout> = {}): InsightWorkout => ({
  id: `w${++n}`, date, kind: "gym", preset: "push", startedAt: `${date}T12:00:00.000Z`, durationMin: 45, kcalBurned: 300,
  kcalEstimated: false, volumeKg: 1000, ...p,
});
const s = (wk: InsightWorkout, exerciseKey: string, weightKg: number | null, reps: number | null, name = exerciseKey): InsightSet => ({
  workoutId: wk.id, date: wk.date, startedAt: wk.startedAt, createdAt: wk.startedAt, exerciseKey, name, weightKg, reps,
});

describe("periodBounds", () => {
  it("week: Monday to today, against the same span last week", () => {
    expect(periodBounds("week", "2026-10-08")).toEqual({ start: "2026-10-05", end: "2026-10-08", prevStart: "2026-09-28", prevEnd: "2026-10-01" });
  });
  it("month: 1st to today, against the previous month's same days", () => {
    expect(periodBounds("month", "2026-10-08")).toEqual({ start: "2026-10-01", end: "2026-10-08", prevStart: "2026-09-01", prevEnd: "2026-09-08" });
  });
  it("month: clamps to a shorter previous month and wraps the year", () => {
    expect(periodBounds("month", "2026-03-31").prevEnd).toBe("2026-02-28");
    expect(periodBounds("month", "2028-03-31").prevEnd).toBe("2028-02-29");
    expect(periodBounds("month", "2027-01-15")).toMatchObject({ prevStart: "2026-12-01", prevEnd: "2026-12-15" });
  });
});

describe("dayType", () => {
  it("is the first gym session's preset, custom for an empty session, activity when only activities", () => {
    expect(dayType([])).toBeNull();
    expect(dayType([w("2026-10-01", { kind: "activity", preset: null, startedAt: "2026-10-01T06:00:00.000Z" }), w("2026-10-01", { preset: "legs" })])).toBe("legs");
    expect(dayType([w("2026-10-01", { preset: "pull", startedAt: "2026-10-01T18:00:00.000Z" }), w("2026-10-01", { preset: "push", startedAt: "2026-10-01T07:00:00.000Z" })])).toBe("push");
    expect(dayType([w("2026-10-01", { preset: null })])).toBe("custom");
    expect(dayType([w("2026-10-01", { kind: "activity", preset: null })])).toBe("activity");
  });
});

describe("monthCalendar", () => {
  it("lays out the month Monday-first with types, today and future", () => {
    const cal = monthCalendar([w("2026-10-02", { preset: "pull" }), w("2026-10-02", { kind: "activity", preset: null }), w("2026-09-30")], "2026-10-08");
    expect(cal.month).toBe("2026-10");
    expect(cal.leadingBlanks).toBe(3); // 1 Oct 2026 is a Thursday
    expect(cal.days).toHaveLength(31);
    expect(cal.days[1]).toEqual({ date: "2026-10-02", type: "pull", isToday: false, isFuture: false });
    expect(cal.days[7]).toMatchObject({ isToday: true, type: null });
    expect(cal.days[8]!.isFuture).toBe(true);
    expect(cal.workoutDays).toBe(1);
  });
});

describe("niceBounds", () => {
  it("fits the axis to the data with round ticks", () => {
    expect(niceBounds([8100, 9600, 7400, 9900, 11000, 10600, 10600, 12400])).toEqual({ min: 5000, max: 15000, ticks: [5000, 10000, 15000] });
  });
  it("never goes below zero and handles flat or empty data", () => {
    expect(niceBounds([0, 0, 0])).toEqual({ min: 0, max: 1000, ticks: [0, 500, 1000] });
    expect(niceBounds([])).toEqual({ min: 0, max: 1000, ticks: [0, 500, 1000] });
  });
});

describe("volumeWeeks", () => {
  it("buckets 8 Monday weeks, oldest first, with the summary numbers", () => {
    const ws = [w("2026-10-06", { volumeKg: 3000 }), w("2026-10-08", { volumeKg: 2000 }), w("2026-09-29", { volumeKg: 4000 }), w("2026-08-17", { volumeKg: 2500 }), w("2026-08-10", { volumeKg: 999 })];
    const v = volumeWeeks(ws, "2026-10-08");
    expect(v.weeks.map((x) => x.start)).toEqual(["2026-08-17", "2026-08-24", "2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05"]);
    expect(v.weeks.map((x) => x.kg)).toEqual([2500, 0, 0, 0, 0, 0, 4000, 5000]);
    expect(v).toMatchObject({ current: 5000, deltaVsLast: 1000, best: 5000, avg: 1437.5, trendPct: 100 });
  });
  it("has no trend when the first week is empty", () => {
    expect(volumeWeeks([w("2026-10-06")], "2026-10-08").trendPct).toBeNull();
  });
});

describe("prEvents", () => {
  it("flags a workout that beats every earlier one; not the first time, not a tie", () => {
    const a = w("2026-09-01"), b = w("2026-09-08"), c = w("2026-09-15"), d = w("2026-09-22");
    const sets = [s(a, "bench_press", 60, 8), s(b, "bench_press", 60, 8), s(c, "bench_press", 62.5, 8), s(c, "bench_press", 50, 5), s(d, "bench_press", 40, 20), s(a, "squat", 80, 5)];
    expect(prEvents(sets)).toEqual([{ workoutId: c.id, date: "2026-09-15", exerciseKey: "bench_press" }]);
  });
  it("ignores sets without a positive weight and reps", () => {
    const a = w("2026-09-01"), b = w("2026-09-08");
    expect(prEvents([s(a, "push_up", null, 20), s(b, "push_up", null, 30)])).toEqual([]);
  });
});

describe("topExercises", () => {
  const p = periodBounds("month", "2026-10-08");
  it("ranks by sets, then volume, then name, with best, e1RM change and an 8-week sparkline", () => {
    const sep = w("2026-09-03"), o1 = w("2026-10-02"), o2 = w("2026-10-06");
    const sets = [
      s(sep, "bench_press", 60, 8, "Bench press"),
      s(o1, "bench_press", 62.5, 8, "Bench press"), s(o1, "bench_press", 62.5, 6, "Bench press"), s(o2, "bench_press", 65, 5, "Bench press"),
      s(o1, "squat", 80, 5, "Back squat"), s(o2, "squat", 80, 5, "Back squat"),
      s(o1, "curl", 10, 12, "Curl"), s(o2, "curl", 10, 12, "Curl"),
      s(o2, "row", 40, 10, "Row"),
    ];
    const top = topExercises(sets, p, "2026-10-08");
    expect(top.map((t) => t.exerciseKey)).toEqual(["bench_press", "squat", "curl"]);
    expect(top[0]).toMatchObject({ name: "Bench press", sets: 3, sessions: 2, best: { weightKg: 62.5, reps: 8 }, e1rm: 79.2 });
    expect(top[0]!.e1rmDelta).toBe(3.2); // 62.5×(1+8/30)=79.17 vs 60×(1+8/30)=76
    expect(top[0]!.spark).toHaveLength(8);
    expect(top[0]!.spark.at(-1)).toBe(75.8); // this week (from 5 Oct) has only 65 × 5: 65 × (1 + 5/30) = 75.83
  });
  it("keeps exercises with no weighted set, with null best", () => {
    const o = w("2026-10-02");
    const top = topExercises([s(o, "plank", null, 3, "Plank")], p, "2026-10-08");
    expect(top).toEqual([{ exerciseKey: "plank", name: "Plank", sets: 1, sessions: 1, best: null, e1rm: null, e1rmDelta: null, spark: [null, null, null, null, null, null, null, null] }]);
  });
});

describe("byType", () => {
  it("counts sessions per type in the fixed order, skipping zeros", () => {
    const ws = [w("2026-10-01", { preset: "legs" }), w("2026-10-02", { preset: "push" }), w("2026-10-03", { preset: "push" }), w("2026-10-03", { kind: "activity", preset: null }), w("2026-09-01")];
    expect(byType(ws, "2026-10-01", "2026-10-08")).toEqual([{ type: "push", sessions: 2 }, { type: "legs", sessions: 1 }, { type: "activity", sessions: 1 }]);
  });
});

describe("periodTiles", () => {
  it("totals the period and compares with the previous one", () => {
    const p = periodBounds("week", "2026-10-08");
    const ws = [
      w("2026-10-05", { durationMin: 50, kcalBurned: 320, volumeKg: 4000 }), w("2026-10-05", { kind: "activity", preset: null, durationMin: 30, kcalBurned: 100, volumeKg: 0, kcalEstimated: true }),
      w("2026-10-07", { durationMin: 40, kcalBurned: 280, volumeKg: 3000 }),
      w("2026-09-29", { durationMin: 45, kcalBurned: 300, volumeKg: 3500 }),
    ];
    const t = periodTiles(ws, [{ workoutId: ws[2]!.id, date: "2026-10-07", exerciseKey: "bench_press" }], p);
    expect(t).toEqual({
      workoutDays: { value: 2, prev: 1, delta: 1 }, minutes: { value: 120, prev: 45, delta: 75 }, kcal: { value: 700, prev: 300, delta: 400 },
      kcalEstimated: true, volumeKg: { value: 7000, prev: 3500, delta: 3500 }, prs: { value: 1, prev: 0, delta: 1 },
    });
  });
});

describe("goalStreak", () => {
  const days = (...ds: string[]) => ds.map((d) => w(d));
  it("counts back from this week when it's met, else from last week", () => {
    const ws = days("2026-10-05", "2026-10-06", "2026-09-29", "2026-09-30", "2026-09-22", "2026-09-23", "2026-09-08", "2026-09-09");
    expect(goalStreak(ws, "2026-10-08", 2)).toBe(3);
    expect(goalStreak(ws.slice(2), "2026-10-08", 2)).toBe(2); // this week not met yet: last week + the one before
    expect(goalStreak([], "2026-10-08", 2)).toBe(0);
  });
});

describe("buildStats", () => {
  const ws = [w("2026-10-06")];
  it("fills the Pro fields when unlocked and nulls them when locked", () => {
    const open = buildStats({ range: "week", today: "2026-10-08", goal: 3, workouts: ws, sets: [], locked: false });
    expect(open.hasWorkouts).toBe(true);
    expect(open.calendar).not.toBeNull();
    expect(open.volume).not.toBeNull();
    expect(open.topExercises).toEqual([]);
    expect(open.byType).toEqual([{ type: "push", sessions: 1 }]);
    const locked = buildStats({ range: "week", today: "2026-10-08", goal: 3, workouts: ws, sets: [], locked: true });
    expect(locked).toMatchObject({ locked: true, calendar: null, volume: null, topExercises: null, byType: null });
    expect(locked.tiles.workoutDays.value).toBe(1);
  });
  it("has no workouts for a new user", () => {
    expect(buildStats({ range: "week", today: "2026-10-08", goal: 3, workouts: [], sets: [], locked: false }).hasWorkouts).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to check they fail.** Run `pnpm test lib/fitness/insights.test.ts`. Expected: FAIL, "Cannot find module './insights'".

- [ ] **Step 3: Write `lib/fitness/insights.ts`:**

```ts
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
  return {
    weeks, current, deltaVsLast: round2(current - (kgs.at(-2) ?? 0)), best: Math.max(0, ...kgs),
    avg: round2(kgs.reduce((t, k) => t + k, 0) / Math.max(1, kgs.length)),
    trendPct: first > 0 ? Math.round(((current - first) / first) * 100) : null,
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

export function periodTiles(workouts: InsightWorkout[], prs: { date: string }[], p: Period): PeriodTiles {
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
```

- [ ] **Step 4: Run the tests to check they pass.** Run `pnpm test lib/fitness/insights.test.ts`, then `pnpm typecheck` and `pnpm lint`. Expected: all green.
  - If an expectation is off by rounding, recompute it by hand from the formulas above. Fix the **test** only if the hand calculation agrees with the code. Otherwise fix the code.

- [ ] **Step 5: Commit.**

```bash
git add lib/fitness/insights.ts lib/fitness/insights.test.ts
git commit -m "feat(fitness): pure insights for the Workouts hub (periods, calendar, volume, top exercises, tiles, streak)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Data, gates and APIs

**Files:**
- Modify: `lib/db/schema.ts` (profile: `heightCm`, `fitnessOnboardedAt`, plus a CHECK)
- Create: `lib/db/migrations/0011_*.sql` (generated, then the backfill appended), and its snapshot and journal entries
- Modify: `lib/credits/plan-features.ts` (`fitnessInsights`)
- Modify: `lib/fitness/types.ts` (`FitnessSettings` gains `heightCm`; new `HistoryPage`)
- Modify: `lib/fitness/service.ts` (`getFitnessStats`, `historyPage`, `completeFitnessSetup`; `FitnessSettingsSchema` gains `heightCm`)
- Create: `app/api/v1/fitness/stats/route.ts`, `app/api/v1/workouts/history/route.ts`, `app/api/v1/me/fitness/setup/route.ts`
- Modify: `app/api/v1/me/fitness/route.ts` (the error copy mentions height)
- Test: `lib/fitness/insights.int.test.ts` (new), and an extended `lib/fitness/service.int.test.ts` if it fits better there

**Interfaces:**
- Consumes: `buildStats`, `FitnessStats`, `InsightWorkout`, `InsightSet` and `StatsRange` from Task 1; `allows(plan, feature)` from `@/lib/credits/plans`; `logWeight(userId, { date, kg })` from `@/lib/fitness/weight`; `apiError(status, code, message)` from `@/lib/http`.
- Produces:
  - `getFitnessStats(userId: string, range: StatsRange, now?: Date): Promise<FitnessStats>`. It applies the lock itself, as `locked = !allows(profile.plan, "fitnessInsights")`. For a locked user it **throws `ProRequiredError`** when `range === "month"`. Add `ProRequiredError` to `lib/errors.ts` if no equivalent exists.
  - `historyPage(userId: string, cursor: string | null, limit = 20): Promise<HistoryPage>`, where `HistoryPage = { items: WorkoutListItem[]; nextCursor: string | null }`. The cursor is opaque base64url of `date|startedAtISO|createdAtISO|id`. Ordering is the same as `queryList`, newest first, with a keyset `<` on `(date, started_at, created_at, id)`.
  - `completeFitnessSetup(userId: string, raw: unknown, now?: Date): Promise<FitnessSettings>`.
  - `FitnessSettings = { weeklyWorkoutGoal: number; goalWeightKg: number | null; heightCm: number | null }`.
  - `profile.fitnessOnboardedAt: Date | null` and `profile.heightCm: number | null` on the profile row that `getProfile` returns.
  - `GATED_FEATURES` now includes `"fitnessInsights"`.

- [ ] **Step 1: Schema.** In `lib/db/schema.ts`, add these to `profile`, after `goalWeightKg`:

```ts
  /** Optional, from the Workouts setup or Me → Fitness (spec "First-visit setup"); stored only for now. */
  heightCm: smallint("height_cm"),
  /** Set when the Workouts setup is finished or skipped; null shows the setup on /workouts. */
  fitnessOnboardedAt: timestamp("fitness_onboarded_at", { withTimezone: true }),
```

Add this to the table's checks array:

```ts
  check("height_cm_range", sql`${t.heightCm} IS NULL OR ${t.heightCm} BETWEEN 100 AND 250`),
```

- [ ] **Step 2: Migration.** Run `pnpm db:generate`. It creates `lib/db/migrations/0011_<name>.sql`; rename it to `0011_fitness_setup.sql`, and update `meta/_journal.json`'s `tag` to match. Then append the backfill:

```sql
--> statement-breakpoint
UPDATE "profile" SET "fitness_onboarded_at" = now()
WHERE "fitness_onboarded_at" IS NULL
  AND (EXISTS (SELECT 1 FROM "workout" w WHERE w."user_id" = "profile"."user_id")
       OR EXISTS (SELECT 1 FROM "body_weight" b WHERE b."user_id" = "profile"."user_id"));
```

Run `pnpm db:migrate`, then `pnpm drizzle-kit check`. Expected: "Everything's fine".

- [ ] **Step 3: Gate.** In `lib/credits/plan-features.ts`:
  - Add `/** The Workouts hub's Pro insights: Month stats, trends, top exercises, how often. */ fitnessInsights: boolean;` to `PlanFeatures`.
  - Set it to `false` for basic and `true` for pro.
  - Append `"fitnessInsights"` to `GATED_FEATURES`.

  Then run `pnpm typecheck` and fix every exhaustive `Record<GatedFeature, …>` it flags. For example, if `lockedFeatures` consumers or the upgrade sheet list feature labels, give the new one the label "Workout insights" with a lucide `TrendingUp` icon.

- [ ] **Step 4: Write the failing int tests** in `lib/fitness/insights.int.test.ts`. Follow the setup pattern of `lib/fitness/weight.int.test.ts`: `createUser`, `resetDb` in `beforeEach`, `testDb()`. Toggle the gates the way `lib/export/*.int.test.ts` does; read it first and reuse its exact mechanism. Cases:
  1. **Owner scoping.** User A's workouts never show in user B's `getFitnessStats` (B has `hasWorkouts: false` and zero tiles).
  2. **Soft delete.** Create two gym workouts today with weighted sets and soft-delete one with `deleteWorkout`. Then:
     - `tiles.volumeKg.value` equals only the kept one's volume;
     - the calendar day's type is the kept one's preset;
     - `historyPage` doesn't list the deleted one;
     - `prEvents` ignores it, so a heavier deleted session doesn't make the next one a non-PR.
  3. **Gates on, Basic.** `getFitnessStats(u, "month")` rejects with `ProRequiredError`. `getFitnessStats(u, "week")` resolves with `locked: true` and `calendar`, `volume`, `topExercises` and `byType` all `null`. With the plan set to pro (`db.update(profile).set({ plan: "pro" })`) Month resolves.
  4. **Gates off.** A Basic user gets Month with every field filled.
  5. **`historyPage`.**
     - Create 25 workouts. The first page has 20 items, newest first, and a `nextCursor`.
     - The second page has 5 items and `nextCursor: null`.
     - There are no duplicates across pages, even with two workouts on the same date and `startedAt`.
     - A garbage cursor is treated as `null`, returning the first page.
  6. **`completeFitnessSetup`.**
     - `{ heightCm: 172, weightKg: 72, goalWeightKg: 70, weeklyWorkoutGoal: 4 }` saves those fields, logs a `body_weight` row for today (in the user's timezone) at 72, and sets `fitnessOnboardedAt`.
     - `{ skip: true }` sets only `fitnessOnboardedAt`.
     - `heightCm: 99` rejects.
  7. **Backfill.** Insert a profile with a workout and `fitness_onboarded_at` null, then run the migration's UPDATE statement verbatim through `testDb().execute(sql.raw(...))`. Afterwards it's set. A profile with neither a workout nor a weight stays null.

  Run `pnpm test:int lib/fitness/insights.int.test.ts`. Expected: FAIL (the functions don't exist).

- [ ] **Step 5: Implement the service** in `lib/fitness/service.ts`:

```ts
export const StatsQuerySchema = z.object({ range: z.enum(["week", "month"]).default("week") });

/** Every visible workout as insight rows (a person's history is small; no range needed for streaks and PRs). */
async function insightRows(userId: string): Promise<{ workouts: InsightWorkout[]; sets: InsightSet[] }> {
  const rows = await queryList(userId, {});
  const workouts: InsightWorkout[] = rows.map((r) => ({
    id: r.id, date: r.date, kind: r.kind, preset: r.preset, startedAt: r.startedAt, durationMin: r.durationMin,
    kcalBurned: r.kcalBurned, kcalEstimated: r.kcalEstimated, volumeKg: r.volumeKg,
  }));
  const setRows = await db.select({
    workoutId: workout.id, date: workout.date, startedAt: workout.startedAt, createdAt: workout.createdAt,
    exerciseKey: workoutExercise.exerciseKey, name: workoutExercise.name, weightKg: workoutSet.weightKg, reps: workoutSet.reps,
  }).from(workoutSet)
    .innerJoin(workoutExercise, eq(workoutSet.exerciseId, workoutExercise.id))
    .innerJoin(workout, eq(workoutExercise.workoutId, workout.id))
    .where(and(visibleWorkoutWhere(userId), eq(workoutSet.done, true)));
  const sets: InsightSet[] = setRows.map((s) => ({ ...s, startedAt: s.startedAt.toISOString(), createdAt: s.createdAt.toISOString() }));
  return { workouts, sets };
}

/** GET /api/v1/fitness/stats: the hub's numbers; Month and the Pro fields need `fitnessInsights`. */
export async function getFitnessStats(userId: string, range: StatsRange, now: Date = new Date()): Promise<FitnessStats> {
  const prof = await getProfile(userId);
  const locked = !allows(prof.plan, "fitnessInsights");
  if (locked && range === "month") throw new ProRequiredError("Month stats are part of Pro.");
  const { workouts, sets } = await insightRows(userId);
  return buildStats({ range, today: todayIn(prof.timezone, now), goal: prof.weeklyWorkoutGoal, workouts, sets, locked });
}
```

  - **`historyPage`:** keyset on the tuple, as described under Interfaces. Decode the cursor with `Buffer.from(c, "base64url")`, split it on `|`, and validate each part with a zod tuple: a date, two ISO datetimes and a uuid. On any failure treat the cursor as `null`. Fetch `limit + 1` rows; if there are more than `limit`, `nextCursor` encodes the last returned item. The `id` tiebreak is `desc(workout.id)`, appended to the `queryList` ordering.
  - **`completeFitnessSetup`:**

```ts
export const FitnessSetupSchema = z.union([
  z.object({ skip: z.literal(true) }),
  z.object({
    heightCm: z.number().int().min(100).max(250).nullable().optional(),
    weightKg: z.number().min(20).max(400).nullable().optional(),
    goalWeightKg: z.number().min(20).max(400).nullable().optional(),
    weeklyWorkoutGoal: z.number().int().min(1).max(7),
  }),
]);
```

    - **Skip:** set `fitnessOnboardedAt: new Date()` only.
    - **Otherwise:** call `updateFitnessSettings` for goal, goal weight and height. If `weightKg` is given, call `logWeight(userId, { date: todayIn(prof.timezone, now), kg: weightKg })`. That also runs the I1 burn recompute. Then set `fitnessOnboardedAt`.
    - Return the settings.
  - **`FitnessSettingsSchema`** gains `heightCm: z.number().int().min(100).max(250).nullable().optional()`. `updateFitnessSettings` writes it, and the return value includes `heightCm: prof.heightCm`.

- [ ] **Step 6: Routes** (thin, in the style of `app/api/v1/fitness/summary/route.ts`):
  - **`GET /api/v1/fitness/stats?range=week|month`**
    - A bad range gives `invalid("Pick week or month.")`.
    - Catch `ProRequiredError` and return `apiError(403, "PRO_REQUIRED", "Month stats are part of Pro.")`.
    - Otherwise `json(stats)`.
  - **`GET /api/v1/workouts/history?cursor=`** returns `json(await historyPage(userId, cursor))`.
  - **`POST /api/v1/me/fitness/setup`**
    - Parse failure gives `invalid("Height is 100–250 cm, weights 20–400 kg and the goal 1–7 days.")`.
    - Otherwise `json({ fitness })`.
  - **`PATCH /api/v1/me/fitness`:** extend the error copy to mention height.

- [ ] **Step 7: Run** `pnpm test:int`, `pnpm test`, `pnpm typecheck` and `pnpm lint`. Expected: all green, with the new int tests passing.

- [ ] **Step 8: Commit.**

```bash
git add -A lib app/api
git commit -m "feat(fitness): stats, history paging and training setup APIs; fitnessInsights gate; height and setup columns

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Navigation, look and Today

**Files:**
- Modify: `components/app-nav.tsx` (phone and desktop items)
- Modify: `app/(app)/progress/page.tsx` (drop the Fitness view and redirect `?view=fitness`), `components/progress/workouts-card.tsx` (link to `/workouts`)
- Delete: `components/progress/fitness/view-switch.tsx`
- Move: `components/progress/fitness/fitness-view.tsx` and `weight-card.tsx` → `components/workouts/` (Task 4 rebuilds the page from these pieces)
- Create: `components/workouts/day-type.ts` (labels and colour classes per `DayType`)
- Create: `app/(app)/workouts/page.tsx` (temporary: renders the moved `FitnessView`, so the route works now)
- Modify: every `IconTile tone="protein"` under `components/fitness`, `components/workouts`, `components/today` and `components/progress` that shows a workout or activity → `tone="brand"`
- Modify: back fallbacks: `components/fitness/log-workout.tsx`, `components/fitness/workout-actions.tsx`, `components/fitness/weight/weight-log.tsx` → `"/workouts"`; the delete success in `workout-actions.tsx` → `router.replace("/workouts")`
- Modify: `app/(app)/today/page.tsx` (render `WorkoutsCard` once, in the main column under the meals; remove it from the `<aside>`)
- Modify: Me: add a "Scan history" row linking to `/history` with the count (find where `historyCount` is computed in `app/(app)/layout.tsx` and reuse that query), and a Height field in `components/me/fitness-section.tsx` (cm, 100–250, clearable, saved through `PATCH /api/v1/me/fitness`)
- Modify: `scripts/ui-audit.ts` (replace the `progress-fitness` scenario with `workouts` at `/workouts`; update `today-energy` if its selectors moved)

**Interfaces:**
- Consumes: `DayType` and `DAY_TYPES` from Task 1; `heightCm` on `FitnessSettings` and `PATCH /api/v1/me/fitness` from Task 2.
- Produces:
  - `DAY_TYPE_META: Record<DayType, { label: string; dot: string; bar: string }>` in `components/workouts/day-type.ts`. Labels: Push, Pull, Legs, Back, Shoulders, Custom, Activity. `dot` and `bar` are Tailwind classes: `bg-brand`, `bg-protein`, `bg-warn`, `bg-carbs`, `bg-fat`, `bg-brand-deep/60`, `bg-subtle/70`. Check that each `bg-*` token exists in the `@theme` block of `app/globals.css`, and add any that are missing as `--color-*` aliases, in both themes via the existing variables.
  - The `/workouts` route exists and the nav points at it.

- [ ] **Step 1: Nav.**
  - **Phone:** `PHONE_ITEMS = [Today /today CalendarDays, Workouts /workouts Dumbbell, Scan (primary), Progress /progress LineChart, Me /me User]`.
  - **Desktop:** `DESKTOP_ITEMS = [Today, Workouts /workouts Dumbbell, Progress, Foods, History (showCount)]`.
  - `active("/workouts")` must not light up while on `/workouts/session`. Use an exact match for `/workouts`, and `startsWith` for the others as today.
  - The phone nav stays hidden on `/workouts/*`, but `/workouts` itself shows it (the existing `startsWith("/workouts/")` already does this).
- [ ] **Step 2: Progress.** At the top of `ProgressPage`, add `if (params.view === "fitness") redirect("/workouts");` (from `next/navigation`). Then delete the Fitness branch, the `ViewSwitch` import and `view-switch.tsx`. Update `components/progress/workouts-card.tsx` to link to `/workouts`, with the copy "Workouts · Your week, trends and history."
- [ ] **Step 3: Move and create the route.**
  - Move `fitness-view.tsx` and `weight-card.tsx` to `components/workouts/` with `git mv`, and fix the imports.
  - Create `app/(app)/workouts/page.tsx`. It calls `requireUser()` and loads `getFitnessSummary` and `getWeightHistory(userId, { days: 30 })`. It renders an `h1` "Workouts" and `<FitnessView …/>` inside the same grid wrapper the Progress fitness branch used.
  - Add `export const metadata = { title: "Workouts — EATRi8" }` if sibling pages do the same.
- [ ] **Step 4: Icon tone.** Run `grep -rn 'tone="protein"' components app`. Switch every workout or activity tile to `tone="brand"`. The `protein` tone stays only where it means protein. Leave the IconTile `protein` tone definition in place if anything still uses it; otherwise delete it and its comment.
- [ ] **Step 5: Day-type meta.** Create `components/workouts/day-type.ts` as described under Interfaces.
- [ ] **Step 6: Back fallbacks and delete target**, as listed under Files.
- [ ] **Step 7: Today.**
  - Remove `className="md:hidden"` from the main-column `WorkoutsCard` and move it to after the meals grid, still inside the main column.
  - Delete the `<WorkoutsCard …/>` in the `<aside>`.
  - Fix the comment above the layout.
- [ ] **Step 8: Me.**
  - Add the "Scan history" row (lucide `History` icon, count on the right, links to `/history`). Put it in the same list style as the other Me rows, above Appearance.
  - Add the Height field to the Fitness section.
- [ ] **Step 9: Audit.** In `scripts/ui-audit.ts`:
  - Replace `progress-fitness` with `{ name: "workouts", path: () => "/workouts", setup: () => sleep(1200), check: expectAll("section[aria-label='Weekly goal']", "a[href='/weight']") }`.
  - Add `{ name: "progress-fitness-redirect", path: () => "/progress?view=fitness", check: expectAll("h1") }`, and assert the final URL ends with `/workouts` if the harness exposes `page.url()`; otherwise skip this scenario.
- [ ] **Step 10: Verify.**
  - Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:int` and `pnpm build`. Before building, stop the dev server; afterwards restart it with `nohup pnpm dev > /dev/null 2>&1 &` and wait until `/sign-in` returns 200.
  - Then run `pnpm ui:audit`. Expected: 0 offenders and 0 errors. If the date rolled over and the audit errors on a missing demo state, run `pnpm seed:demo` first.
- [ ] **Step 11: Commit.**

```bash
git add -A
git commit -m "feat(workouts): /workouts route in the nav, lime workout tiles, Progress back to food, Today card in the main column

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The /workouts page: setup, states, layout, free stats, history

**Files:**
- Modify: `app/(app)/workouts/page.tsx` (the server page; reads `?range=week|month`)
- Create:
  - `components/workouts/setup-form.tsx` (client)
  - `components/workouts/empty-hub.tsx`
  - `components/workouts/hub.tsx` (layout)
  - `components/workouts/range-switch.tsx` (client, Week | Month links)
  - `components/workouts/stat-tiles.tsx`
  - `components/workouts/week-dots.tsx`
  - `components/workouts/history-list.tsx` (client, "Show more")
- Modify: `components/workouts/fitness-view.tsx`. Split it into reusable `GoalCard`, `UpNextCard` and `WeightCard` exports, and delete what's no longer used.

**Interfaces:**
- Consumes:
  - `getFitnessStats`, `historyPage`, `getFitnessSummary` (for `upNext` and the goal) and `getWeightHistory`;
  - `POST /api/v1/me/fitness/setup` and `GET /api/v1/workouts/history?cursor=`;
  - `DAY_TYPE_META`;
  - `FitnessStats`, `PeriodTiles` and `Delta` from Task 1;
  - `allows(plan, "fitnessInsights")`;
  - `ProBadge` and `UpgradeSheet` from `components/pro/*`.
- Produces: `<Hub stats summary weight history plan locked>` with a **`proSlot` prop**: a `ReactNode` rendered in the left column after Up next (the Trends card plus Top exercises) and a `proAside` rendered in the right column after the tiles (How often). Task 5 fills both slots. Until then they're `null`.

- [ ] **Step 1: The page's state machine** in `app/(app)/workouts/page.tsx`:

```tsx
export default async function WorkoutsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { userId, profile } = await requireUser();
  if (!profile.fitnessOnboardedAt) return <SetupForm defaults={{ weeklyWorkoutGoal: profile.weeklyWorkoutGoal, goalWeightKg: profile.goalWeightKg, heightCm: profile.heightCm }} />;
  const locked = !allows(profile.plan, "fitnessInsights");
  const asked = (await searchParams).range === "month" ? "month" : "week";
  const range = asked === "month" && locked ? "week" : asked;
  const [stats, summary, weight, history] = await Promise.all([
    getFitnessStats(userId, range), getFitnessSummary(userId), getWeightHistory(userId, { days: 30 }), historyPage(userId, null),
  ]);
  if (!stats.hasWorkouts) return <EmptyHub summary={summary} weight={weight} />;
  return <Hub stats={stats} summary={summary} weight={weight} history={history} locked={locked} proSlot={null} proAside={null} />;
}
```

- [ ] **Step 2: SetupForm**, matching mockup ① (`workouts-layout.html`):
  - **Header:** the title "Set up your training" and its sub-line (copy from Global Constraints).
  - **One card with three numeric fields.** Use `inputMode` and `parseAmount` like the existing number inputs:
    - Height: cm, an integer.
    - Current weight: kg, one decimal.
    - Goal weight: kg, optional.
  - **A second card:** "Workout days a week", 7 chips with `aria-pressed`.
  - **"Continue"** (pill, lime, full width, single line, `Check` icon) POSTs the values. Fields left empty go as `null`, and the weekly goal always goes.
  - **"Skip for now"** (ghost) POSTs `{ skip: true }`.
  - **On success:** `router.refresh()`.
  - **Errors:** a 400 shows the server message in a `role="alert"` line.
  - Every field has a `<label>`.
- [ ] **Step 3: EmptyHub**, matching mockup ②:
  - an `h1` "Workouts";
  - the goal card with "0 of {goal} workout days" and the sub-line "Your first session starts the streak";
  - the label "Start a session";
  - a 2-column grid of 6 preset tiles: Push day, Pull day, Leg day, Back day and Shoulders day, each linking to `/workouts/session?preset=<key>`, plus "Empty" linking to `?preset=empty`. Each tile is an `IconTile tone="brand"` with `Dumbbell`;
  - an Other activity row linking to `/workouts/new#activity`, or to whatever `log-workout.tsx` uses to open the activity list;
  - the weight card.

  No history, tiles or charts.
- [ ] **Step 4: Hub layout**, matching `workouts-full-v3.html`:
  - **Header row:** the `h1` "Workouts" plus `RangeSwitch`.
    - `RangeSwitch` has Week and Month links (`?range=`).
    - When locked, Month is a button that opens `UpgradeSheet` and shows `ProBadge size="sm"`.
  - **Desktop** (`md:` and up, same breakpoint as Today): `grid md:grid-cols-[minmax(0,1fr)_300px] gap-3.5 md:gap-5`.
    - Left column: UpNext (with an "Other activity" ghost button and a "Start" lime button), `proSlot`, then History.
    - Right column: GoalCard, WeekDots, StatTiles, `proAside`, then WeightCard.
  - **Phone:** one column, ordered goal, up next, `proSlot`, tiles, `proAside`, weight, history. Use CSS `order-*` utilities on the same DOM, not duplicated markup. Check that the tab order still reads sensibly.
- [ ] **Step 5: WeekDots.** Seven dots, Mon–Sun, each coloured by the type of that day in the current week. Use `dayType` over `summary.week` dates; Task 1's `dayType` takes workouts, so pass that week's workouts from `summary.recent`. **Ruling:** `summary.recent` holds only 5 items, so compute the week's types in `getFitnessSummary`. Add `type: DayType | null` to `WeekDay` in `lib/fitness/types.ts` and `stats.ts` `weekSummary`, and extend the `weekSummary` unit test. Today is outlined, and future days are faint. Each dot has an aria-label like "Tue, Pull day" or "Wed, rest".
- [ ] **Step 6: StatTiles.** A 2 × 3 grid:
  - Workout days
  - Total time (`fmtDuration`)
  - Burned (prefixed with "~" when `kcalEstimated`, `en-IN` grouping)
  - Volume (as tonnes with one decimal when ≥ 1000 kg, else kg)
  - New PRs
  - Goal streak ("{n} wks")

  Each tile's sub-line shows the delta: "+3 vs last week" or "+3 vs Sep" (the previous month's short name, from `SHORT_MONTHS`). It's lime when positive, muted when zero or negative, with a sign. The streak tile's sub-line reads "goal hit" or "in a row".
- [ ] **Step 7: HistoryList.**
  - The server passes the first page.
  - "Show more" (a ghost pill, single line) fetches `/api/v1/workouts/history?cursor=` and appends the results.
  - It hides when `nextCursor` is null.
  - Rows reuse `components/fitness/workout-row.tsx`.
  - The card is titled "History".
- [ ] **Step 8: Verify.** Run lint, typecheck, test, test:int, then build and restart dev as in Task 3. Run `pnpm shot /workouts` at 390 and 1280, dark, and look at both images: no clipped text, CTAs on one line, and lime tiles. Then run `pnpm ui:audit --only workouts`. Expected: 0 offenders.
- [ ] **Step 9: Commit.**

```bash
git add -A
git commit -m "feat(workouts): setup, empty state, hub layout, week dots by type, stat tiles, paged history

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Pro insight cards

**Files:**
- Create:
  - `components/workouts/trends-card.tsx` (client: Calendar | Volume switch)
  - `components/workouts/month-calendar.tsx`
  - `components/workouts/volume-chart.tsx` (hand-rolled SVG)
  - `components/workouts/top-exercises.tsx`
  - `components/workouts/how-often.tsx`
  - `components/workouts/pro-preview.tsx` (the locked blurred card)
  - `components/workouts/sample-stats.ts` (static sample data for the preview)
- Modify: `app/(app)/workouts/page.tsx` (fill `proSlot` and `proAside`)

**Interfaces:**
- Consumes: `FitnessStats` (`calendar`, `volume`, `topExercises`, `byType`), `DAY_TYPE_META`, `DAY_TYPES`, `ProBadge` and `UpgradeSheet`.
- Produces: the finished page.

- [ ] **Step 1: TrendsCard.**
  - A card whose header holds a title and a segmented switch, "Calendar" and "Volume" (`role="tablist"`, two `role="tab"` buttons with `aria-selected`, arrow-key switching).
  - The title is "{Month name}" on the calendar tab and "Last 8 weeks" on the volume tab.
  - The tab is remembered in `localStorage` under `eatri8-trends-tab`. Wrap the access in try/catch. It defaults to `calendar`, and it's read in an effect, never during render, so there's no hydration mismatch.
  - The card header carries `ProBadge size="sm"`.
- [ ] **Step 2: MonthCalendar.**
  - Weekday headers M T W T F S S. There are `leadingBlanks` empty cells, then one cell per day: a rounded square with height 30 px on phone and 34 px on desktop.
  - A day with a type is coloured `DAY_TYPE_META[type].dot`. Rest days are `bg-sunken`. Future days are `bg-sunken` at 50% opacity. Today gets `ring-2 ring-ink`.
  - Each cell has an `aria-label`, for example "Thu 2 Oct, Pull day" or "Fri 3 Oct, rest", and the grid is `role="grid"`.
  - The header sub-text is "{workoutDays} workout days".
  - Underneath is a legend of the types that appear, in `DAY_TYPES` order.
- [ ] **Step 3: VolumeChart.** An SVG with a `viewBox` of `0 0 620 190` on desktop. The chart measures its width with a `ResizeObserver` and redraws geometry for the real width, so the text never scales. Use a `useMeasure`-style hook with a 320 px fallback on the server. The geometry follows `chart-stack-or-switch-v2.html`:
  - left padding 34, right padding 30, top 12, bottom 24;
  - three gridlines and labels from `axis.ticks`, formatted "{t/1000} t";
  - a dashed average line labelled "avg {x} t";
  - a lime area plus a line;
  - a hollow point for each week, and a filled, larger last point labelled with its value;
  - x labels "{d MMM}" at each week's start, with the last one "This wk".

  Above the chart are a big number (`current` in tonnes) and a delta ("+1.8 t vs last week"). Below it are three chips: Best, Avg, and Trend ("{pct}%", or "–" when null). All text uses theme tokens via `fill="currentColor"` on `text-subtle` and `text-ink` wrappers. Give the SVG `role="img"` and an `aria-label` summarising the data, for example "Weekly volume, last 8 weeks: 8.1 t to 12.4 t".
- [ ] **Step 4: TopExercises.** Card title "Top exercises", sub-text "by sets this week" or "by sets this month", and `ProBadge`. Each row has:
  - a rank circle;
  - the name;
  - "{sets} sets · {sessions} sessions · best {kg} × {reps}", without the best part when it's null;
  - a 70 × 22 sparkline of `spark` (nulls skipped by breaking the line);
  - on the right, "e1RM {kg} kg" and its delta ("+4 kg", or nothing when null).

  With no exercises in the period it shows "No sets logged this {week|month} yet."
- [ ] **Step 5: HowOften.** Card title "How often", sub "sessions", and `ProBadge`. One row per `byType` entry: the label, a bar whose width is relative to the maximum, coloured `DAY_TYPE_META[type].bar`, and the count. With no entries it shows "No sessions this {week|month} yet."
- [ ] **Step 6: ProPreview** (only when `locked`):
  - One card. Its content is `TrendsCard` plus `TopExercises`, rendered from `sample-stats.ts`: a static, plausible `MonthCalendar`, `VolumeWeeks` and `TopExercise[]`, written as literals that type-check against Task 1's types.
  - The content gets `aria-hidden`, `inert`, `blur-[5px]` and `opacity-55`.
  - An overlay is centred on it: "See your trends with Pro", the sub-line, and a lime pill "See Pro" with a `Sparkles` icon that opens `UpgradeSheet`.
  - On a locked page, `proSlot` is `<ProPreview/>` and `proAside` is `null`.
- [ ] **Step 7: Wire it up.** In the page:

```tsx
const proSlot = locked ? <ProPreview /> : <><TrendsCard calendar={stats.calendar!} volume={stats.volume!} /><TopExercises items={stats.topExercises!} range={stats.range} /></>;
const proAside = locked ? null : <HowOften items={stats.byType!} range={stats.range} />;
```

- [ ] **Step 8: Verify.**
  - Lint, typecheck, test, test:int, then build and restart dev.
  - Run `pnpm shot /workouts` and `/workouts?range=month` at 390 and 1280, in dark and light.
  - Look at the images: the chart has no big empty band, labels aren't clipped, the legend shows, and the calendar fits.
  - Run `pnpm ui:audit --only workouts` in both gate modes, following whatever flag or env the audit uses for `gates: "locked"`. Expected: 0 offenders.
- [ ] **Step 9: Commit.**

```bash
git add -A
git commit -m "feat(workouts): Pro insights (Calendar | Volume trends, top exercises, how often) with a locked preview

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Demo data, audit coverage and docs

**Files:**
- Modify: `scripts/seed-demo.ts`
- Modify: `scripts/ui-audit.ts` and `scripts/lib/browser.ts` (support a per-scenario demo user)
- Modify: `README.md` (feature list and the Pro features row: add "workout insights")
- Modify: `docs/design/mock-c1.html` only if it documents the Progress → Fitness screen. Add one line saying it moved to `/workouts`; no redesign.

**Interfaces:**
- Consumes: everything above.
- Produces: `pnpm seed:demo` writes three cookie files:
  - `.superpowers/demo-cookie.txt` (unchanged: demo user, onboarded, 10 weeks of workouts);
  - `.superpowers/demo-fresh-cookie.txt` (a second local user, onboarded for food, `fitness_onboarded_at` null);
  - `.superpowers/demo-starter-cookie.txt` (onboarded for fitness, no workouts).

- [ ] **Step 1: Seed.** Extend `seedWorkouts` to 10 weeks, keeping this week's sessions exactly as they are, so the Today energy strip and the PR scenario still hold.
  - **Older weeks:**
    - 3–4 gym sessions a week, rotating push, pull, legs, back and shoulders;
    - one or two walks or runs;
    - weights growing about 1–2% a week;
    - one deliberate rest week (week −6) with a single walk, so the streak breaks.
  - **The demo profile:** set `fitnessOnboardedAt` to now and `heightCm` to 172.
  - **Two extra users,** each created the same way the demo user is (reuse its helper; read how `seed-demo.ts` creates the user and session cookie):
    - "Fresh Demo" with email `fresh@demo.local`;
    - "Starter Demo" with email `starter@demo.local`.
  - **Starter** gets `fitnessOnboardedAt` set and a weight of 68 kg today.
  - The `assertLocalDb` guard must run before any write.
  - Print the three cookie paths.
- [ ] **Step 2: Audit users.** Add an optional `user?: "demo" | "fresh" | "starter"` to `Scenario`. `setCookies` loads the matching cookie file (default `demo`). Then add these scenarios:
  - `workouts-setup` (fresh, `/workouts`, check `h1` text "Set up your training" and every input has a label)
  - `workouts-empty` (starter, `/workouts`, check there's no element with text "History" and there are 6 preset links)
  - `workouts` (demo; already added) plus `workouts-month` (demo, `/workouts?range=month`)
  - `workouts-volume` (demo, setup: click the "Volume" tab, `viewportShot: false`, check `svg[role=img]`)
  - `workouts-locked` (demo, `gates: "locked"`, check the "See Pro" button exists and that `[role=tablist]` doesn't exist outside an `[aria-hidden]` subtree)
  - `today` scenarios: the existing `equalMealCards` check must still pass with the Workouts card in the main column. Adjust the check's container selector if it counted siblings.
- [ ] **Step 3: Docs.** README:
  - the feature list mentions the Workouts page (setup, weekly stats, Pro insights);
  - the `PRO_GATES_ENFORCED` row's Pro list gains "workout insights (Month stats, trends, top exercises, how often)";
  - the routes table, if there is one, adds `/workouts`, `GET /api/v1/fitness/stats`, `GET /api/v1/workouts/history` and `POST /api/v1/me/fitness/setup`.
- [ ] **Step 4: Verify everything.**
  - `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:int`.
  - Stop dev, `pnpm build`, restart dev (`nohup pnpm dev > /dev/null 2>&1 &`) and wait for `/sign-in` to return 200.
  - `pnpm seed:demo`.
  - `pnpm ui:audit` (gates open) and the locked run. Expected: 0 offenders and 0 errors in both.
  - Look at `pnpm shot /workouts` at 390 and 1280 dark once more.
- [ ] **Step 5: Commit.**

```bash
git add -A
git commit -m "chore(workouts): 10-week demo data, fresh and starter demo users, audit coverage, README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
