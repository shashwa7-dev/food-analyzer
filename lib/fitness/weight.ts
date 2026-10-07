// Body weight (spec §C): one entry per user per local day; logging again that day replaces it.
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { bodyWeight } from "@/lib/db/schema";
import { addDays, DateSchema, todayIn } from "@/lib/dates";
import { PlainDateSchema } from "@/lib/fitness/service";
import { weightChange } from "@/lib/fitness/stats";
import type { WeightEntry, WeightHistory } from "@/lib/fitness/types";
import { getProfile } from "@/lib/profile/service";

export const LogWeightSchema = z.object({ date: DateSchema, kg: z.number().min(20).max(400) });
export const WeightQuerySchema = z.object({ days: z.coerce.number().int().min(7).max(366).default(90) });

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Logs `kg` for `date`, replacing that day's earlier value. */
export async function logWeight(userId: string, raw: z.input<typeof LogWeightSchema>): Promise<WeightEntry> {
  const input = LogWeightSchema.parse(raw);
  const kg = round2(input.kg);
  const [row] = await db.insert(bodyWeight).values({ userId, date: input.date, kg })
    .onConflictDoUpdate({ target: [bodyWeight.userId, bodyWeight.date], set: { kg, createdAt: new Date() } })
    .returning({ date: bodyWeight.date, kg: bodyWeight.kg });
  return row!;
}

export async function deleteWeight(userId: string, date: string): Promise<boolean> {
  if (!PlainDateSchema.safeParse(date).success) return false;
  const rows = await db.delete(bodyWeight).where(and(eq(bodyWeight.userId, userId), eq(bodyWeight.date, date))).returning({ date: bodyWeight.date });
  return rows.length === 1;
}

/**
 * GET /api/v1/weight: the last `days` days of entries (default 90, ending today in the user's timezone),
 * newest first, plus the latest entry ever and its 30-day change, and the goal weight.
 */
export async function getWeightHistory(userId: string, raw: z.input<typeof WeightQuerySchema> = {}, now: Date = new Date()): Promise<WeightHistory> {
  const { days } = WeightQuerySchema.parse(raw);
  const prof = await getProfile(userId);
  const today = todayIn(prof.timezone, now);
  const mine = eq(bodyWeight.userId, userId);
  const cols = { date: bodyWeight.date, kg: bodyWeight.kg };
  const [entries, [latest]] = await Promise.all([
    db.select(cols).from(bodyWeight).where(and(mine, gte(bodyWeight.date, addDays(today, -(days - 1))), lte(bodyWeight.date, addDays(today, 1)))).orderBy(desc(bodyWeight.date)),
    db.select(cols).from(bodyWeight).where(mine).orderBy(desc(bodyWeight.date)).limit(1),
  ]);
  let change30d: number | null = null;
  if (latest) {
    const window = await db.select(cols).from(bodyWeight).where(and(mine, gte(bodyWeight.date, addDays(latest.date, -30)), lte(bodyWeight.date, latest.date)));
    change30d = weightChange(window, 30);
  }
  return { entries, latest: latest ?? null, change30d, goalWeightKg: prof.goalWeightKg };
}
