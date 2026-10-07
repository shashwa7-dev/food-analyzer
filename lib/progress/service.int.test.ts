import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createUser, resetDb } from "@/tests/helpers/db";
import { db } from "@/lib/db/client";
import { foodLog, profile } from "@/lib/db/schema";
import { addDays } from "@/lib/dates";
import type { Grade, Nutrients } from "@/lib/nutrition/types";
import { getProgress } from "./service";

const NOW = new Date("2026-10-07T12:00:00Z");

async function log(userId: string, date: string, kcal: number, grade: Grade | null = null, extra: Partial<Nutrients> = {}) {
  await db.insert(foodLog).values({
    userId, date, meal: "lunch", name: "Thing",
    portion: { label: "1 serving", amount: 1, unit: "serving", grams: null },
    nutrients: { energyKcal: kcal, protein: 10, carbs: 50, fat: 10, ...extra },
    grade,
  });
}

describe("getProgress", () => {
  beforeEach(resetDb);

  it("aggregates the user's days by date with grade kcal, and never includes another user", async () => {
    const a = await createUser();
    const b = await createUser();
    await log(a, "2026-10-06", 300, "A", { sodiumMg: 400, fibre: 5 });
    await log(a, "2026-10-06", 200, "E", { sodiumMg: 600 });
    await log(a, "2026-10-07", 500);
    await log(b, "2026-10-07", 9999, "A", { sodiumMg: 9999 });

    const s = await getProgress(a, "week", NOW);
    expect(s.days).toHaveLength(7);
    expect(s.days.at(-1)).toMatchObject({ date: "2026-10-07", kcal: 500, entries: 1 });
    expect(s.days.at(-2)).toMatchObject({ date: "2026-10-06", kcal: 500, entries: 2, sodiumMg: 1000, fibre: 5, protein: 20 });
    expect(s.days.at(-2)!.gradeKcal).toEqual({ A: 300, E: 200 });
    expect(s.days.at(-1)!.gradeKcal).toEqual({});
    expect(s.kpis.daysLogged).toBe(2);
    expect(s.kpis.streak).toBe(2);
    expect(s.gradeMix).toEqual({ A: 60, B: 0, C: 0, D: 0, E: 40 });
    expect(s.days.reduce((t, d) => t + d.kcal, 0)).toBe(1000);
  });

  it("keeps the window to the range and uses the profile's targets", async () => {
    const a = await createUser();
    await db.update(profile).set({ goal: "weight_loss", targets: { energyKcal: 1600 } }).where(eq(profile.userId, a));
    await log(a, "2026-09-30", 1000); // 8 days back: outside week, inside month
    await log(a, "2026-10-08", 1000); // tomorrow: never counted
    await log(a, "2026-10-07", 1400);

    const week = await getProgress(a, "week", NOW);
    expect(week.targets.energyKcal).toBe(1600);
    expect(week.kpis.daysLogged).toBe(1);
    expect(week.kpis.daysOnTarget).toBe(1); // 1400 / 1600 = 87.5%, inside 80–100%

    const month = await getProgress(a, "month", NOW);
    expect(month.days).toHaveLength(30);
    expect(month.days[0]!.date).toBe("2026-09-08");
    expect(month.kpis.daysLogged).toBe(2);
  });

  it("counts the streak past the start of the range", async () => {
    const a = await createUser();
    for (let i = 0; i < 12; i++) await log(a, addDays("2026-10-07", -i), 1800);
    await log(a, "2026-09-20", 1800); // after a gap: not part of the streak
    const s = await getProgress(a, "week", NOW);
    expect(s.kpis.streak).toBe(12);
    expect(s.kpis.daysLogged).toBe(7);
  });

  it("shows a streak that reaches the lookback as 365+", async () => {
    const a = await createUser();
    const portion = { label: "1 serving", amount: 1, unit: "serving" as const, grams: null };
    const rows = Array.from({ length: 400 }, (_, i) => ({
      userId: a, date: addDays("2026-10-07", -i), meal: "lunch" as const, name: "Thing", portion,
      nutrients: { energyKcal: 1800, protein: 10, carbs: 50, fat: 10 },
    }));
    await db.insert(foodLog).values(rows);
    const s = await getProgress(a, "week", NOW);
    expect(s.kpis).toMatchObject({ streak: 365, streakCapped: true });
  });

  it("finds today in the profile timezone", async () => {
    const a = await createUser();
    await db.update(profile).set({ timezone: "Asia/Kolkata" }).where(eq(profile.userId, a));
    await log(a, "2026-10-07", 700);
    const s = await getProgress(a, "week", new Date("2026-10-06T19:00:00Z")); // 00:30 IST on 7 Oct
    expect(s.days.at(-1)).toMatchObject({ date: "2026-10-07", kcal: 700 });

    await db.update(profile).set({ timezone: "America/New_York" }).where(eq(profile.userId, a));
    const ny = await getProgress(a, "week", new Date("2026-10-06T19:00:00Z")); // 15:00 on 6 Oct in New York
    expect(ny.days.at(-1)!.date).toBe("2026-10-06");
    expect(ny.kpis.daysLogged).toBe(0);
  });

  it("returns a zeroed summary for a user with no log", async () => {
    const a = await createUser();
    const s = await getProgress(a, "week", NOW);
    expect(s.kpis).toEqual({ avgKcal: 0, avgProtein: 0, daysOnTarget: 0, daysLogged: 0, streak: 0, streakCapped: false });
    expect(s.worstOverLimit).toBeNull();
  });
});
