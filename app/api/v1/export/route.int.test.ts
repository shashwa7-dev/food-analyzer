import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createUser, resetDb } from "@/tests/helpers/db";
import { db } from "@/lib/db/client";
import { foodLog, profile, scan } from "@/lib/db/schema";

const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/lib/session", async () => {
  const { unauthorized } = await import("@/lib/http");
  return { requireApiUser: async () => session.userId ?? unauthorized() };
});

const { GET } = await import("./route");
const call = (what?: string) => GET(new Request(`http://localhost/api/v1/export${what === undefined ? "" : `?what=${what}`}`));
const lines = async (res: Response) => (await res.text()).replace(/^﻿/, "").split("\r\n").filter(Boolean);

const portion = { label: "1 katori", amount: 1, unit: "household" as const, grams: 150 };
async function logFood(userId: string, name: string, date = "2026-10-01") {
  await db.insert(foodLog).values({ userId, date, meal: "lunch", name, portion, nutrients: { energyKcal: 180.04, protein: 9.06, carbs: 25, fat: 4, sodiumMg: 420 }, grade: "B" });
}

describe("GET /api/v1/export", () => {
  beforeEach(async () => {
    await resetDb();
    session.userId = null;
  });
  afterEach(() => vi.unstubAllEnvs());

  it("needs a session", async () => {
    expect((await call("diary")).status).toBe(401);
  });

  it("refuses an unknown or missing kind", async () => {
    session.userId = await createUser();
    expect((await call("passwords")).status).toBe(400);
    expect((await call()).status).toBe(400);
  });

  it("streams only the caller's diary as CSV, escaping names", async () => {
    const me = (session.userId = await createUser());
    const other = await createUser();
    await logFood(me, 'Dal "tadka", homemade');
    await logFood(me, "=HYPERLINK(\"x\")", "2026-10-02");
    await logFood(other, "Someone else's lunch");
    const res = await call("diary");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="eatri8-diary-\d{4}-\d{2}-\d{2}\.csv"$/);
    const [header, ...rows] = await lines(res);
    expect(header).toBe("date,meal,food,portion,amount,grams,energy_kcal,protein_g,carbs_g,fat_g,fibre_g,sugars_g,sat_fat_g,sodium_mg,grade,logged_at");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatch(/^2026-10-01,lunch,"Dal ""tadka"", homemade",1 katori,1,150,180,9.1,25,4,,,,420,B,/);
    expect(rows[1]).toContain(`"'=HYPERLINK(""x"")"`);
    expect(rows.join("\n")).not.toContain("Someone else");
  });

  it("streams the caller's scans, leaving out deleted ones and other users'", async () => {
    const me = (session.userId = await createUser());
    const other = await createUser();
    const base = { status: "failed" as const, inputKind: "label" as const, engineVersion: "t", errorCode: "UNREADABLE_IMAGE" };
    await db.insert(scan).values([
      { ...base, userId: me },
      { ...base, userId: me, errorCode: "DELETED_ONE", deletedAt: new Date() },
      { ...base, userId: other, errorCode: "OTHER_USER" },
    ]);
    const res = await call("scans");
    expect(res.status).toBe(200);
    const [header, ...rows] = await lines(res);
    expect(header).toBe("scanned_at,mode,status,name,brand,grade,confidence,barcode,basis,energy_kcal_per_100,error");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatch(/,label,failed,,,,,,,,UNREADABLE_IMAGE$/);
  });

  it("writes logged_at and scanned_at on the user's clock: a 01:00 IST entry shows the same day as its date", async () => {
    const me = (session.userId = await createUser()); // profile timezone defaults to Asia/Kolkata
    const at = new Date("2026-10-01T19:30:00Z"); // 01:00 on 2 Oct in IST
    await db.insert(foodLog).values({ userId: me, date: "2026-10-02", meal: "breakfast", name: "Chai", portion, nutrients: { energyKcal: 30, protein: 1, carbs: 5, fat: 1 }, createdAt: at });
    await db.insert(scan).values({ userId: me, status: "failed", inputKind: "label", engineVersion: "t", errorCode: "UNREADABLE_IMAGE", createdAt: at });
    const [, diary] = await lines(await call("diary"));
    expect(diary).toMatch(/^2026-10-02,breakfast,Chai,.*,2026-10-02 01:00$/);
    const [, scanned] = await lines(await call("scans"));
    expect(scanned).toMatch(/^2026-10-02 01:00,label,failed,/);
    await db.update(profile).set({ timezone: "America/New_York" }).where(eq(profile.userId, me));
    expect((await lines(await call("diary")))[1]).toMatch(/,2026-10-01 15:30$/);
  });

  it("writes just the header with nothing logged", async () => {
    session.userId = await createUser();
    expect(await lines(await call("diary"))).toHaveLength(1);
  });

  it("is Pro-only once PRO_GATES_ENFORCED is on (403 PRO_REQUIRED for Basic)", async () => {
    session.userId = await createUser();
    vi.stubEnv("PRO_GATES_ENFORCED", "true");
    for (const what of ["diary", "scans", "workouts", "weight"]) {
      const res = await call(what);
      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe("PRO_REQUIRED");
    }
    await db.update(profile).set({ plan: "pro" }).where(eq(profile.userId, session.userId));
    expect((await call("diary")).status).toBe(200);
    expect((await call("scans")).status).toBe(200);
  });

  it("answers 400 NOT_AVAILABLE for workouts and weight until the fitness tracker lands", async () => {
    session.userId = await createUser();
    for (const what of ["workouts", "weight"]) {
      const res = await call(what);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("NOT_AVAILABLE");
    }
  });
});
