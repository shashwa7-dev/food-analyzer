import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createUser, resetDb, testDb, waitUntilBlocked } from "@/tests/helpers/db";
import { food, foodLog, userFoodStats } from "@/lib/db/schema";
import type { CrowdCandidate } from "@/lib/engine";
import { crowdDraft, upsertCrowdFood } from "@/lib/scans/crowd";
import { cacheOffFood } from "./insert";
import { toFoodDraft, type SourceRecord } from "./seed-map";

const CODE = "8901491101837";
const per100 = { energyKcal: 554, protein: 11, carbs: 51.7, fat: 34, sugars: 2, satFat: 15, sodiumMg: 1050 };
const offDraft = () => toFoodDraft({
  source: "off", sourceRef: CODE, barcode: CODE, name: "Aloo Bhujia", brand: "Shree Rama", basis: "per_100g", per100, portions: [],
  categories: ["en:snacks"], countries: ["IN"],
} satisfies SourceRecord, []);
const candidate = (barcode: string | null): CrowdCandidate => ({
  name: "Aloo Bhujia", brand: "Shree Rama", barcode, basis: "per_100g", per100,
  portions: [{ label: "100 g", amount: 100, unit: "g", grams: 100 }], ingredients: [], allergens: [], mayContain: [], additives: [], categories: ["en:snacks"],
});
const crowdRow = (barcode: string | null) => testDb().transaction((tx) => upsertCrowdFood(tx, crowdDraft(candidate(barcode), "IN")));
const holders = () => testDb().select({ id: food.id, source: food.source }).from(food).where(eq(food.barcode, CODE));

beforeEach(resetDb);

describe("cacheOffFood: a barcoded crowd row committed mid-insert (review N2)", () => {
  it("retries after the food_barcode_uq violation and caches OFF's row, the crowd row giving up the code", async () => {
    let commitA!: () => void;
    const gate = new Promise<void>((r) => { commitA = r; });
    let inserted!: () => void;
    const insertedA = new Promise<void>((r) => { inserted = r; });

    // Transaction A: a label job inserting a barcoded crowd row, held open until B is blocked on it.
    const a = testDb().transaction(async (tx) => {
      await upsertCrowdFood(tx, crowdDraft(candidate(CODE), "IN"));
      inserted();
      await gate;
    });
    await insertedA;

    // B: an OFF hit for the same code. Its release UPDATE can't see A's row; its INSERT waits on the barcode index.
    const b = cacheOffFood(offDraft());
    b.catch(() => {}); // awaited below; this only keeps a timed-out poll from leaving an unhandled rejection
    try {
      await waitUntilBlocked('insert into "food"');
    } finally {
      commitA(); // always release A, so a timeout fails the test instead of hanging the suite
      await a;
    }

    const off = await b; // without the retry this rejects with 23505 on food_barcode_uq
    expect(off.source).toBe("off");
    expect(await holders()).toEqual([{ id: off.id, source: "off" }]);
    expect(await testDb().select({ barcode: food.barcode }).from(food).where(eq(food.source, "crowd"))).toEqual([{ barcode: null }]);
  });
});

describe("cacheOffFood: dropping a barcoded crowd row in favour of its twin (review N3)", () => {
  it("re-points users' stats (merged) and diary entries at the twin", async () => {
    const twin = (await crowdRow(null))!;
    const old = (await crowdRow(CODE))!;
    const both = await createUser(); const onlyOld = await createUser();
    const earlier = new Date("2026-10-01T08:00:00Z"), later = new Date("2026-10-05T08:00:00Z");
    await testDb().insert(userFoodStats).values([
      { userId: both, foodId: twin, uses: 2, lastUsedAt: earlier },
      { userId: both, foodId: old, uses: 3, lastUsedAt: later },
      { userId: onlyOld, foodId: old, uses: 1, lastUsedAt: earlier },
    ]);
    const entry = { date: "2026-10-05", meal: "snack" as const, name: "Aloo Bhujia", portion: { label: "100 g", amount: 100, unit: "g" as const, grams: 100 }, nutrients: per100 };
    const [logged] = await testDb().insert(foodLog).values({ ...entry, userId: onlyOld, foodId: old }).returning();

    const off = await cacheOffFood(offDraft());

    expect(await holders()).toEqual([{ id: off.id, source: "off" }]);
    expect(await testDb().select({ id: food.id }).from(food).where(eq(food.id, old))).toEqual([]);
    const stats = await testDb().select().from(userFoodStats);
    expect(stats.map((s) => s.foodId)).toEqual([twin, twin]);
    expect(stats.find((s) => s.userId === both)).toMatchObject({ uses: 5, lastUsedAt: later });
    expect(stats.find((s) => s.userId === onlyOld)).toMatchObject({ uses: 1, lastUsedAt: earlier });
    const [entryAfter] = await testDb().select().from(foodLog).where(eq(foodLog.id, logged!.id));
    expect(entryAfter!.foodId).toBe(twin);
  });

  it("adds the dropped row's popularity to the twin's", async () => {
    const twin = (await crowdRow(null))!;
    const old = (await crowdRow(CODE))!;
    await testDb().update(food).set({ popularity: 3 }).where(eq(food.id, twin));
    await testDb().update(food).set({ popularity: 4 }).where(eq(food.id, old));
    await cacheOffFood(offDraft());
    const [t] = await testDb().select({ popularity: food.popularity }).from(food).where(eq(food.id, twin));
    expect(t!.popularity).toBe(7);
  });
});
