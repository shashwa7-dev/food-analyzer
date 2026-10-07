import { and, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { foodLog } from "@/lib/db/schema";
import { addDays, todayIn } from "@/lib/dates";
import { getProfile } from "@/lib/profile/service";
import { targetsFor } from "@/lib/nutrition/targets";
import type { Grade, NutrientKey } from "@/lib/nutrition/types";
import { rangeDays, summarize, type DayAgg, type ProgressSummary, type Range } from "./aggregate";

/** How far back the logging streak may reach. */
const STREAK_LOOKBACK_DAYS = 365;

// A nutrient from the per-entry snapshot. The key travels as a bound parameter (never raw SQL)
// and is typed to the fixed NutrientKey union, so only the snapshot's own keys can appear.
const nutrient = (key: NutrientKey): SQL<number> => sql<number>`coalesce((${foodLog.nutrients} ->> ${key}::text)::float, 0)`;
const total = (key: NutrientKey): SQL<number> => sql<number>`coalesce(sum(${nutrient(key)}), 0)`;
const gradeKcal = (g: Grade): SQL<number> => sql<number>`coalesce(sum(${nutrient("energyKcal")}) filter (where ${foodLog.grade} = ${g}), 0)`;

export async function getProgress(userId: string, range: Range, now: Date = new Date()): Promise<ProgressSummary> {
  const prof = await getProfile(userId);
  const today = todayIn(prof.timezone, now);
  const start = addDays(today, -(rangeDays(range) - 1));
  const mine = eq(foodLog.userId, userId);

  const [rows, streakRows] = await Promise.all([
    db.select({
      date: foodLog.date,
      entries: sql<number>`count(*)::int`,
      kcal: total("energyKcal"), protein: total("protein"), carbs: total("carbs"), fat: total("fat"),
      fibre: total("fibre"), sugars: total("sugars"), sodiumMg: total("sodiumMg"), satFat: total("satFat"),
      gA: gradeKcal("A"), gB: gradeKcal("B"), gC: gradeKcal("C"), gD: gradeKcal("D"), gE: gradeKcal("E"),
    }).from(foodLog)
      .where(and(mine, gte(foodLog.date, start), lte(foodLog.date, today)))
      .groupBy(foodLog.date),
    // The streak can run past the range, so it reads the distinct logged dates for the last year.
    db.selectDistinct({ date: foodLog.date }).from(foodLog)
      .where(and(mine, gte(foodLog.date, addDays(today, -STREAK_LOOKBACK_DAYS)), lte(foodLog.date, today))),
  ]);

  const days: DayAgg[] = rows.map((r) => {
    const g: DayAgg["gradeKcal"] = {};
    for (const [grade, v] of [["A", r.gA], ["B", r.gB], ["C", r.gC], ["D", r.gD], ["E", r.gE]] as const) if (Number(v) > 0) g[grade] = Number(v);
    return {
      date: r.date, entries: Number(r.entries),
      kcal: Number(r.kcal), protein: Number(r.protein), carbs: Number(r.carbs), fat: Number(r.fat),
      fibre: Number(r.fibre), sugars: Number(r.sugars), sodiumMg: Number(r.sodiumMg), satFat: Number(r.satFat),
      gradeKcal: g,
    };
  });
  return summarize(days, targetsFor(prof.goal, prof.targets), prof.goal, today, range, streakRows.map((r) => r.date));
}
