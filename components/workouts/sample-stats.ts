import type { DayType, MonthCalendar, TopExercise, VolumeWeeks } from "@/lib/fitness/insights";

// Static sample data for ProPreview (workouts-full-v3.html's locked card): plausible numbers, never
// read from the database. The content built from these is always `aria-hidden`/`inert` and blurred,
// so the exact values never matter — only that they type-check against Task 1's types and render.

const MONTH = "2026-10";
const TODAY = "2026-10-22";

const TYPE_BY_DAY: Partial<Record<number, DayType>> = {
  3: "push", 5: "pull", 6: "activity",
  8: "legs", 9: "push", 11: "pull", 12: "shoulders", 13: "activity",
  15: "legs", 17: "push", 18: "back", 20: "activity", 21: "activity", 22: "pull",
};

const days = Array.from({ length: 31 }, (_, i) => {
  const day = i + 1;
  const date = `${MONTH}-${String(day).padStart(2, "0")}`;
  return { date, type: date <= TODAY ? (TYPE_BY_DAY[day] ?? null) : null, isToday: date === TODAY, isFuture: date > TODAY };
});

export const SAMPLE_CALENDAR: MonthCalendar = {
  month: MONTH,
  leadingBlanks: 3,
  days,
  workoutDays: days.filter((d) => d.type !== null).length,
};

const WEEKS = [
  { start: "2026-08-31", kg: 8100 },
  { start: "2026-09-07", kg: 9400 },
  { start: "2026-09-14", kg: 7700 },
  { start: "2026-09-21", kg: 10200 },
  { start: "2026-09-28", kg: 11100 },
  { start: "2026-10-05", kg: 10500 },
  { start: "2026-10-12", kg: 10600 },
  { start: "2026-10-19", kg: 12400 },
];

export const SAMPLE_VOLUME: VolumeWeeks = {
  weeks: WEEKS,
  current: 12400,
  deltaVsLast: 1800,
  best: 12400,
  avg: 10000,
  trendPct: 31,
  axis: { min: 6000, max: 14000, ticks: [6000, 10000, 14000] },
};

export const SAMPLE_TOP_EXERCISES: TopExercise[] = [
  { exerciseKey: "bench_press", name: "Bench press", sets: 18, sessions: 6, best: { weightKg: 65, reps: 8, e1rm: 82.3 }, e1rm: 82, e1rmDelta: 4, spark: [68, 70, 71, 74, 76, 78, 80, 82] },
  { exerciseKey: "back_squat", name: "Back squat", sets: 15, sessions: 5, best: { weightKg: 90, reps: 5, e1rm: 105 }, e1rm: 104, e1rmDelta: 5, spark: [92, 94, 95, 97, 99, 100, 102, 104] },
  { exerciseKey: "lat_pulldown", name: "Lat pulldown", sets: 12, sessions: 4, best: { weightKg: 55, reps: 10, e1rm: 73.3 }, e1rm: 73, e1rmDelta: 1, spark: [70, 70, 71, 71, 72, 72, 73, 73] },
];
