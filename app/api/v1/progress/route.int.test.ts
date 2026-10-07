import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUser, resetDb } from "@/tests/helpers/db";
import { db } from "@/lib/db/client";
import { foodLog } from "@/lib/db/schema";
import { todayIn } from "@/lib/dates";

const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/lib/session", async () => {
  const { unauthorized } = await import("@/lib/http");
  return { requireApiUser: async () => session.userId ?? unauthorized() };
});

const { GET } = await import("./route");
const call = (qs = "") => GET(new Request(`http://localhost/api/v1/progress${qs}`));

describe("GET /api/v1/progress", () => {
  beforeEach(async () => {
    await resetDb();
    session.userId = null;
  });

  it("needs a session", async () => {
    expect((await call()).status).toBe(401);
  });

  it("defaults to the week, accepts month, and rejects anything else", async () => {
    session.userId = await createUser();
    const week = await (await call()).json();
    expect(week.range).toBe("week");
    expect(week.days).toHaveLength(7);
    const month = await (await call("?range=month")).json();
    expect(month.days).toHaveLength(30);
    const bad = await call("?range=year");
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe("INVALID_INPUT");
  });

  it("only returns the caller's own log", async () => {
    const a = await createUser();
    const b = await createUser();
    const today = todayIn("Asia/Kolkata");
    const portion = { label: "1 serving", amount: 1, unit: "serving" as const, grams: null };
    await db.insert(foodLog).values([
      { userId: a, date: today, meal: "lunch", name: "Mine", portion, nutrients: { energyKcal: 400, protein: 10, carbs: 50, fat: 10 } },
      { userId: b, date: today, meal: "lunch", name: "Theirs", portion, nutrients: { energyKcal: 9000, protein: 10, carbs: 50, fat: 10 } },
    ]);
    session.userId = a;
    const s = await (await call()).json();
    expect(s.days.at(-1).kcal).toBe(400);
    expect(s.kpis.daysLogged).toBe(1);
  });
});
