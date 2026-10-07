import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createUser, resetDb } from "@/tests/helpers/db";
import { db } from "@/lib/db/client";
import { bodyWeight, profile } from "@/lib/db/schema";
import { addDays, todayIn } from "@/lib/dates";
import { deleteWeight, getWeightHistory, logWeight } from "./weight";

const today = () => todayIn("Asia/Kolkata");

describe("body weight", () => {
  let me = "";
  let other = "";
  beforeEach(async () => {
    await resetDb();
    me = await createUser();
    other = await createUser();
  });

  it("upserts per date: a second log on the same day replaces the first", async () => {
    expect(await logWeight(me, { date: today(), kg: 72.4 })).toEqual({ date: today(), kg: 72.4 });
    expect(await logWeight(me, { date: today(), kg: 72.06 })).toEqual({ date: today(), kg: 72.06 });
    await logWeight(other, { date: today(), kg: 90 });
    const rows = await db.select().from(bodyWeight).where(eq(bodyWeight.userId, me));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.kg).toBe(72.06);
  });

  it("refuses an implausible weight or a date out of range", async () => {
    await expect(logWeight(me, { date: today(), kg: 5 })).rejects.toThrow();
    await expect(logWeight(me, { date: addDays(today(), 3), kg: 70 })).rejects.toThrow();
  });

  it("returns the user's history newest first with the latest, 30-day change and goal", async () => {
    await db.update(profile).set({ goalWeightKg: 68 }).where(eq(profile.userId, me));
    for (const [daysAgo, kg] of [[60, 80], [25, 74], [10, 73.2], [0, 72.4]] as const) await logWeight(me, { date: addDays(today(), -daysAgo), kg });
    await logWeight(other, { date: addDays(today(), -1), kg: 100 });
    const h = await getWeightHistory(me, { days: 30 });
    expect(h.entries.map((e) => e.kg)).toEqual([72.4, 73.2, 74]);
    expect(h.latest).toEqual({ date: today(), kg: 72.4 });
    expect(h.change30d).toBe(-1.6);
    expect(h.goalWeightKg).toBe(68);
    expect((await getWeightHistory(me)).entries).toHaveLength(4);
    expect(await getWeightHistory(await createUser())).toEqual({ entries: [], latest: null, change30d: null, goalWeightKg: null });
  });

  it("deletes one date, only the user's own", async () => {
    await logWeight(me, { date: today(), kg: 72 });
    await logWeight(other, { date: today(), kg: 90 });
    expect(await deleteWeight(me, "not-a-date")).toBe(false);
    expect(await deleteWeight(me, "2026-02-30")).toBe(false);
    expect(await deleteWeight(me, today())).toBe(true);
    expect(await deleteWeight(me, today())).toBe(false);
    expect(await db.select().from(bodyWeight)).toHaveLength(1);
  });
});
