import { beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { createUser, resetDb } from "@/tests/helpers/db";
import { db } from "@/lib/db/client";
import { food, profile, scan } from "@/lib/db/schema";
import { buildResult, type ScanResult } from "@/lib/engine/result";
import { updateProfile } from "@/lib/profile/service";
import { targetsFor } from "@/lib/nutrition/targets";
import { NotFoundError } from "@/lib/errors";
import { gradeFood } from "@/lib/nutrition/grade";
import { foodIconKey } from "./icon";
import { upsertFood, upsertFoods } from "./insert";
import { toFoodDraft, parseHouseholdCsv } from "./seed-map";
import { createCustomFood, createCustomFoodFromScan, customFoodFieldError, CustomFoodSchema, deleteCustomFood, findAlternatives, findFoodByBarcode, foodDetail, getFoodForUser, getOwnCustomFoodForEdit, myFoods, recentFoods, searchFoodRows, searchFoods, updateCustomFood } from "./service";

const rules = parseHouseholdCsv("keyword,label,grams\nrice,1 katori,150\n");
const rec = (sourceRef: string, name: string, per100 = { energyKcal: 130, protein: 2.7, carbs: 28, fat: 0.3 }, source: "indb" | "fndds" = "indb") =>
  toFoodDraft({ source, sourceRef, name, basis: "per_100g", per100, portions: [], countries: source === "indb" ? ["IN"] : ["US"] }, rules);

describe("foods service", () => {
  beforeEach(async () => {
    await resetDb();
    await upsertFoods([
      rec("1", "Rice, white, boiled"), rec("2", "Rice flour, raw", { energyKcal: 366, protein: 6, carbs: 80, fat: 1.4 }, "fndds"),
      rec("3", "Paneer butter masala"), rec("4", "Dal tadka"), rec("5", "Jeera rice"),
      { ...rec("6", "Rice, raw, milled", { energyKcal: 356, protein: 7, carbs: 78, fat: 0.5 }, "fndds"), kind: "ingredient" },
    ]);
  });

  it("finds Hinglish, typos and prefixes", async () => {
    const u = await createUser();
    expect((await searchFoods(u, "chawal", "IN")).map((h) => h.name)).toContain("Rice, white, boiled");
    expect((await searchFoods(u, "panner", "IN"))[0]?.name).toBe("Paneer butter masala");
    expect((await searchFoods(u, "dal", "IN"))[0]?.name).toBe("Dal tadka");
  });

  it("search hits carry the default portion's index, unit and the food's icon key", async () => {
    const u = await createUser();
    const hits = await searchFoods(u, "rice", "IN");
    const rows = await searchFoodRows(u, "rice", "IN");
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      const row = rows.find((r) => r.id === h.id)!;
      expect(h.defaultPortion.index).toBe(row.portions[row.defaultPortion] ? row.defaultPortion : 0);
      expect(h.defaultPortion.label).toBe(row.portions[h.defaultPortion.index!]!.label);
      expect(h.defaultPortion.unit).toBe(row.basis === "per_100ml" ? "ml" : "g");
      expect(h.iconKey).toBe(foodIconKey(row));
    }
    const boiled = hits.find((h) => h.name === "Rice, white, boiled")!;
    expect(boiled.iconKey).toBe("bowl");
    expect(boiled.defaultPortion).toMatchObject({ label: "1 katori", grams: 150, unit: "g" });
  });

  it("ranks cooked foods above raw ingredients", async () => {
    const u = await createUser();
    const names = (await searchFoods(u, "rice", "IN")).map((h) => h.name);
    expect(names.indexOf("Rice, white, boiled")).toBeLessThan(names.indexOf("Rice, raw, milled"));
    expect(names.indexOf("Rice, white, boiled")).toBeLessThan(names.indexOf("Rice flour, raw"));
  });

  it("ranks the plain staple above dishes that merely start with the word", async () => {
    await upsertFoods([
      rec("10", "Rice upma"), rec("11", "Rice murukku"), rec("12", "Rice, cooked, NFS", undefined, "fndds"),
      rec("13", "Boiled rice (Uble chawal)"), rec("14", "Rice milk", undefined, "fndds"), rec("15", "Rice cake", undefined, "fndds"),
    ]);
    const u = await createUser();
    const names = (await searchFoods(u, "rice", "IN")).map((h) => h.name);
    expect(names.indexOf("Rice, cooked, NFS")).toBeLessThan(names.indexOf("Rice upma"));
    expect(names.indexOf("Rice, cooked, NFS")).toBeLessThan(names.indexOf("Rice murukku"));
    expect(names.slice(0, 3)).toContain("Boiled rice (Uble chawal)");
    expect((await searchFoods(u, "chawal", "IN"))[0]?.name).toBe("Boiled rice (Uble chawal)");
  });

  it("never returns or exposes another user's custom food", async () => {
    const a = await createUser(); const b = await createUser();
    const mine = await createCustomFood(a, { name: "Mom's rajma", per: { amount: 1, unit: "serving" }, servingGrams: 250, nutrients: { energyKcal: 350, protein: 14, carbs: 48, fat: 10 } });
    expect((await searchFoods(b, "rajma", "IN")).some((h) => h.id === mine.id)).toBe(false);
    expect(await getFoodForUser(b, mine.id)).toBeNull();
    expect(await foodDetail(b, mine.id)).toBeNull();
    expect((await searchFoods(a, "rajma", "IN"))[0]?.id).toBe(mine.id);
    const edit = { name: "Hacked", per: { amount: 100, unit: "g" as const }, nutrients: { energyKcal: 1, protein: 0, carbs: 0, fat: 0 } };
    expect(await updateCustomFood(b, mine.id, edit)).toBeNull();
    expect(await deleteCustomFood(b, mine.id)).toBe(false);
    expect(await updateCustomFood(a, "not-a-uuid", edit)).toBeNull();
  });

  it("soft-deletes custom foods", async () => {
    const a = await createUser();
    const f = await createCustomFood(a, { name: "Protein bar", per: { amount: 100, unit: "g" }, nutrients: { energyKcal: 380, protein: 30, carbs: 40, fat: 12 } });
    expect(await deleteCustomFood(a, f.id)).toBe(true);
    expect(await getFoodForUser(a, f.id)).toBeNull();
    expect(await deleteCustomFood(a, f.id)).toBe(false);
  });

  it("converts per-serving custom input to per 100 g and grades it as a dish", async () => {
    const a = await createUser();
    const f = await createCustomFood(a, { name: "Mom's rajma", per: { amount: 1, unit: "serving" }, servingGrams: 250, nutrients: { energyKcal: 350, protein: 14, carbs: 48, fat: 10 } });
    expect(f.per100.energyKcal).toBe(140);
    expect(f.portions[0]).toMatchObject({ label: "1 serving", grams: 250 });
    expect(f.gradeCategory).toBe("dish");
  });

  it("flags allergens from the name when a food has no ingredient list", async () => {
    const a = await createUser();
    await db.update(profile).set({ allergies: ["milk"] }).where(eq(profile.userId, a));
    const [hit] = await searchFoods(a, "paneer butter masala", "IN");
    const d = await foodDetail(a, hit!.id);
    expect(d?.flags.some((f) => f.type === "allergen" && f.key === "milk" && f.severity === "contains")).toBe(true);
    expect(d?.ingredientsKnown).toBe(false);
  });

  it("returns ingredientsKnown true when the food has an ingredient list", async () => {
    const a = await createUser();
    await upsertFoods([{ ...rec("20", "Masala chips"), ingredients: ["potato", "oil", "salt"] }]);
    const [hit] = await searchFoods(a, "masala chips", "IN");
    const d = await foodDetail(a, hit!.id);
    expect(d?.ingredientsKnown).toBe(true);
  });

  it("returns recents for the user only", async () => {
    const a = await createUser();
    expect(await recentFoods(a)).toEqual([]);
  });

  it("lists my foods only", async () => {
    const a = await createUser(); const b = await createUser();
    await createCustomFood(a, { name: "Protein bar", per: { amount: 100, unit: "g" }, nutrients: { energyKcal: 380, protein: 30, carbs: 40, fat: 12 } });
    expect((await myFoods(a)).map((h) => h.name)).toEqual(["Protein bar"]);
    expect(await myFoods(b)).toEqual([]);
  });
});

describe("upsertFood (single-row OFF-cache upsert)", () => {
  beforeEach(resetDb);

  it("inserts, then updates the same row on a repeat barcode (same source/sourceRef), keeping its id", async () => {
    const draft = toFoodDraft({ source: "off", sourceRef: "999", barcode: "999", name: "Bhujia", basis: "per_100g",
      per100: { energyKcal: 560, protein: 11, carbs: 42, fat: 38 }, portions: [], countries: ["IN"] }, []);
    const inserted = await upsertFood(draft);
    expect(inserted.barcode).toBe("999");
    expect(inserted.mayContain).toEqual([]);

    const updatedDraft = toFoodDraft({ source: "off", sourceRef: "999", barcode: "999", name: "Bhujia", basis: "per_100g",
      per100: { energyKcal: 560, protein: 11, carbs: 42, fat: 38 }, portions: [], countries: ["IN"], mayContain: ["en:peanuts"] }, []);
    const updated = await upsertFood(updatedDraft);
    expect(updated.id).toBe(inserted.id);
    expect(updated.mayContain).toEqual(["en:peanuts"]);
  });
});

describe("findFoodByBarcode", () => {
  beforeEach(resetDb);

  it("finds a non-custom food by barcode, excludes custom foods and soft-deleted rows", async () => {
    const draft = toFoodDraft({ source: "off", sourceRef: "111", barcode: "111", name: "Bhujia", basis: "per_100g",
      per100: { energyKcal: 560, protein: 11, carbs: 42, fat: 38 }, portions: [], countries: ["IN"] }, []);
    const off = await upsertFood(draft);
    expect((await findFoodByBarcode("111"))?.id).toBe(off.id);
    expect(await findFoodByBarcode("no-such-barcode")).toBeNull();

    // a user's custom food sharing the same literal barcode string is never returned here
    const a = await createUser();
    await createCustomFood(a, { name: "My own Bhujia", per: { amount: 100, unit: "g" }, nutrients: { energyKcal: 1, protein: 1, carbs: 1, fat: 1 } });
    await db.update(food).set({ barcode: "222" }).where(eq(food.ownerId, a));
    expect(await findFoodByBarcode("222")).toBeNull();

    // a crowd food (from one user's label photo) holding a barcode is never the barcode's answer either
    await db.update(food).set({ source: "crowd", sourceRef: null }).where(eq(food.id, off.id));
    expect(await findFoodByBarcode("111")).toBeNull();
    await db.update(food).set({ source: "off", sourceRef: "111" }).where(eq(food.id, off.id));

    await db.update(food).set({ deletedAt: new Date() }).where(eq(food.id, off.id));
    expect(await findFoodByBarcode("111")).toBeNull();
  });
});

describe("searchFoodRows (engine name matching)", () => {
  beforeEach(resetDb);

  it("returns full food rows in the same order and with the same visibility as searchFoods", async () => {
    await upsertFoods([rec("1", "Rice, white, boiled"), rec("5", "Jeera rice"), { ...rec("6", "Rice, raw, milled", undefined, "fndds"), kind: "ingredient" }]);
    const a = await createUser(); const b = await createUser();
    const mine = await createCustomFood(a, { name: "Rice bowl", per: { amount: 100, unit: "g" }, nutrients: { energyKcal: 150, protein: 3, carbs: 30, fat: 1 } });
    const rows = await searchFoodRows(a, "rice", "IN", 10);
    const hits = await searchFoods(a, "rice", "IN", 10);
    expect(rows.map((r) => r.id)).toEqual(hits.map((h) => h.id));
    expect(rows[0]!.per100.energyKcal).toBeTypeOf("number");
    expect(rows[0]!.portions.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.id === mine.id)).toBe(true);
    expect((await searchFoodRows(b, "rice", "IN", 10)).some((r) => r.id === mine.id)).toBe(false);
    expect(await searchFoodRows(a, "r", "IN", 10)).toEqual([]);
  });
});

describe("findAlternatives", () => {
  beforeEach(resetDb);

  const off = (code: string, name: string, per100: { energyKcal: number; protein: number; carbs: number; fat: number; sugars?: number; satFat?: number; sodiumMg?: number; fibre?: number }, countries = ["IN"]) =>
    toFoodDraft({ source: "off", sourceRef: code, barcode: code, name, basis: "per_100g", per100, portions: [], categories: ["en:snacks"], countries }, []);

  it("returns better-graded foods in the same category and country, excluding the food itself", async () => {
    await upsertFoods([
      off("1", "Fried chips", { energyKcal: 560, protein: 6, carbs: 50, fat: 37, satFat: 15, sodiumMg: 900, sugars: 2 }),
      off("2", "Roasted chana", { energyKcal: 360, protein: 20, carbs: 50, fat: 5, satFat: 1, sodiumMg: 50, sugars: 2, fibre: 15 }),
      off("3", "US roasted chana", { energyKcal: 360, protein: 20, carbs: 50, fat: 5, satFat: 1, sodiumMg: 50, sugars: 2, fibre: 15 }, ["US"]),
    ]);
    const u = await createUser();
    const [chips] = await db.select().from(food).where(eq(food.sourceRef, "1"));
    expect(chips!.grade! > "B").toBe(true);
    const alts = await findAlternatives(u, { categories: ["en:snacks"], country: "IN", grade: chips!.grade as "C" | "D" | "E", excludeId: chips!.id });
    expect(alts.map((a) => a.name)).toEqual(["Roasted chana"]);
    expect(await findAlternatives(u, { categories: ["en:snacks"], country: "IN", grade: null })).toEqual([]);
    expect(await findAlternatives(u, { categories: [], country: "IN", grade: "E" })).toEqual([]);
    // foodDetail uses the same query.
    expect((await foodDetail(u, chips!.id))!.alternatives.map((a) => a.name)).toEqual(["Roasted chana"]);
  });
});

describe("createCustomFoodFromScan (Task 9: save a scan to my foods)", () => {
  beforeEach(resetDb);

  function scanResult(overrides: Partial<ScanResult> = {}): ScanResult {
    return {
      kind: "meal", name: "Homemade khichdi bowl", brand: null, foodId: null, basis: "per_100g",
      per100: { energyKcal: 180, protein: 6, carbs: 30, fat: 4 },
      provenance: { energyKcal: "estimate", protein: "estimate", carbs: "estimate", fat: "estimate" },
      portions: [{ label: "1 bowl", amount: 1, unit: "serving", grams: 350 }],
      defaultPortion: 0, grade: "B", gradeValue: 72, components: [{ key: "sugar", label: "Sugar", points: 2, maxPoints: 10, direction: "negative", estimated: true }],
      reasons: [], flags: [], ingredients: ["rice", "lentils", "ghee"], alternatives: [], hints: [],
      confidence: "medium", inputKind: "meal",
      ...overrides,
    };
  }

  async function insertScan(userId: string, opts: { status?: "queued" | "processing" | "done" | "failed"; result?: ScanResult | null; deletedAt?: Date | null } = {}) {
    const [row] = await db.insert(scan).values({
      userId, status: opts.status ?? "done", imageCount: 0, engineVersion: "test",
      result: "result" in opts ? opts.result : scanResult(), deletedAt: opts.deletedAt ?? null,
    }).returning();
    return row!;
  }

  it("copies name/brand/per100/basis/portions/provenance and the result's grade snapshot into a private custom food", async () => {
    const u = await createUser();
    const s = await insertScan(u, { result: scanResult({ brand: "Mom's kitchen" }) });
    const { food: f, created } = await createCustomFoodFromScan(u, s.id);
    expect(created).toBe(true);
    expect(f.sourceRef).toBe(s.id);
    expect(f.ownerId).toBe(u);
    expect(f.source).toBe("custom");
    expect(f.name).toBe("Homemade khichdi bowl");
    expect(f.brand).toBe("Mom's kitchen");
    expect(f.basis).toBe("per_100g");
    expect(f.per100).toEqual({ energyKcal: 180, protein: 6, carbs: 30, fat: 4 });
    expect(f.portions).toEqual([{ label: "1 bowl", amount: 1, unit: "serving", grams: 350 }]);
    expect(f.provenance).toEqual({ energyKcal: "estimate", protein: "estimate", carbs: "estimate", fat: "estimate" });
    // grade is a snapshot of the result, not recomputed
    expect(f.grade).toBe("B");
    expect(f.gradeValue).toBe(72);
    expect(f.gradeComponents).toEqual(scanResult().components);
  });

  it("is a private custom food: the owner's search finds it, another user's search does not", async () => {
    const owner = await createUser(); const other = await createUser();
    const s = await insertScan(owner, { result: scanResult({ name: "Grandma's khichdi special" }) });
    const { food: saved } = await createCustomFoodFromScan(owner, s.id);
    expect((await searchFoods(owner, "khichdi", "IN")).some((h) => h.id === saved.id)).toBe(true);
    expect((await searchFoods(other, "khichdi", "IN")).some((h) => h.id === saved.id)).toBe(false);
    expect(await getFoodForUser(other, saved.id)).toBeNull();
  });

  it("rejects another user's scan with NotFound", async () => {
    const a = await createUser(); const b = await createUser();
    const s = await insertScan(a);
    await expect(createCustomFoodFromScan(b, s.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects a deleted scan with NotFound", async () => {
    const u = await createUser();
    const s = await insertScan(u, { deletedAt: new Date() });
    await expect(createCustomFoodFromScan(u, s.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects a scan that isn't done yet, and a malformed scan id", async () => {
    const u = await createUser();
    const s = await insertScan(u, { status: "queued", result: null });
    await expect(createCustomFoodFromScan(u, s.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(createCustomFoodFromScan(u, "not-a-uuid")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("is idempotent per scan: a second save returns the same food and the user keeps one row", async () => {
    const u = await createUser();
    const s = await insertScan(u);
    const first = await createCustomFoodFromScan(u, s.id);
    const second = await createCustomFoodFromScan(u, s.id);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.food.id).toBe(first.food.id);
    const rows = await db.select().from(food).where(and(eq(food.ownerId, u), eq(food.source, "custom")));
    expect(rows).toHaveLength(1);
  });

  it("concurrent saves of the same scan create one food", async () => {
    const u = await createUser();
    const s = await insertScan(u);
    const results = await Promise.all([1, 2, 3].map(() => createCustomFoodFromScan(u, s.id)));
    expect(new Set(results.map((r) => r.food.id)).size).toBe(1);
    expect(results.filter((r) => r.created)).toHaveLength(1);
  });

  it("restores a deleted saved food instead of duplicating it", async () => {
    const u = await createUser();
    const s = await insertScan(u);
    const { food: saved } = await createCustomFoodFromScan(u, s.id);
    expect(await deleteCustomFood(u, saved.id)).toBe(true);
    expect(await getFoodForUser(u, saved.id)).toBeNull();
    const again = await createCustomFoodFromScan(u, s.id);
    expect(again.food.id).toBe(saved.id);
    expect(again.food.deletedAt).toBeNull();
    expect(await getFoodForUser(u, saved.id)).not.toBeNull();
  });

  it("keeps the scan link when the saved food is edited, so saving again still returns it", async () => {
    const u = await createUser();
    const s = await insertScan(u);
    const { food: saved } = await createCustomFoodFromScan(u, s.id);
    expect(saved.gradeFrozen).toBe(true);
    const edited = await updateCustomFood(u, saved.id, { name: "My khichdi", per: { amount: 100, unit: "g" }, nutrients: { energyKcal: 170, protein: 6, carbs: 28, fat: 4 } });
    expect(edited!.gradeFrozen).toBe(false); // the grade now comes from the user's numbers, so regrade may refresh it (M6)
    const again = await createCustomFoodFromScan(u, s.id);
    expect(again.food.id).toBe(saved.id);
    expect(again.food.name).toBe("My khichdi");
  });
  it("carries the label's declared allergens and may-contain traces, so personal flags work as on curated foods", async () => {
    const u = await createUser();
    await updateProfile(u, { allergies: ["peanut", "tree_nut"] });
    const profileArgs = { allergies: ["peanut", "tree_nut"], diet: "none" as const, goal: "general" as const, targets: targetsFor("general") };
    // A namkeen label: "Contains: peanut" / "May contain: tree nuts"; the (garbled) ingredient line names neither.
    const facts = {
      name: "Navratan mix", brand: "Haldiram's", foodId: null, kind: "packaged" as const, inputKind: "label" as const, basis: "per_100g" as const,
      per100: { energyKcal: 550, protein: 12, carbs: 45, fat: 36, sodiumMg: 700 }, provenance: { energyKcal: "label" as const },
      portions: [{ label: "100 g", amount: 100, unit: "g" as const, grams: 100 }], defaultPortion: 0, gradeCategory: "general" as const, gradePortionGrams: null,
      ingredients: ["gram flour", "edible vegetable oil", "salt"], nova: null, alternatives: [], hints: [], confidence: "high" as const, profile: profileArgs,
    };
    const result = buildResult({ ...facts, allergens: ["peanut"], mayContain: ["tree_nut"], additives: ["en:e330"] });
    expect(result.flags.map((f) => [f.key, f.severity])).toEqual(expect.arrayContaining([["peanut", "contains"], ["tree_nut", "may_contain"]]));
    const s = await insertScan(u, { result });

    const { food: saved } = await createCustomFoodFromScan(u, s.id);
    expect(saved.allergens).toEqual(["en:peanuts"]);
    expect(saved.mayContain).toEqual(["en:nuts"]);
    expect(saved.additives).toEqual(["en:e330"]);

    // The saved food's page flags exactly what a curated food with the same OFF tags flags.
    const curated = await upsertFood({ ...rec("200", "Navratan mix, curated"), kind: "packaged", ingredients: facts.ingredients, allergens: ["en:peanuts"], mayContain: ["en:nuts"] });
    const pick = (flags: { type: string; key: string; severity: string }[]) => flags.filter((f) => f.type === "allergen").map((f) => [f.key, f.severity]);
    const savedFlags = pick((await foodDetail(u, saved.id))!.flags);
    expect(savedFlags).toEqual([["peanut", "contains"], ["tree_nut", "may_contain"]]);
    expect(savedFlags).toEqual(pick((await foodDetail(u, curated.id))!.flags));
  });

  it("a stored row with an absurd graded per-100 value (pre-bounds OFF data) displays without it and with no grade, everywhere it's read", async () => {
    const u = await createUser();
    // Ashoka Dal Makhani as stored before the bounds existed: sodium 350,428 mg/100 g (a unit error), graded E on it.
    const per100 = { energyKcal: 129.286, protein: 4.286, carbs: 12.143, fat: 6.786, sugars: 0, satFat: 1.286, sodiumMg: 350_428.558 };
    const draft = toFoodDraft({ source: "off", sourceRef: "8906000000001", barcode: "8906000000001", name: "Ashoka Dal Makhani", basis: "per_100g",
      per100: { ...per100, sodiumMg: 500 }, portions: [{ label: "1 pack", amount: 1, unit: "pack", grams: 280 }], categories: ["en:meals"], countries: ["IN"] }, rules);
    const g = gradeFood({ gradeCategory: draft.gradeCategory, per100 });
    const stored = await upsertFood({ ...draft, per100, provenance: { ...draft.provenance, sodiumMg: "community" }, grade: g.grade, gradeValue: g.value, gradeComponents: g.components });
    expect(stored.per100.sodiumMg).toBe(350_428.558); // the row itself is left as stored (no data rewrite)
    expect(stored.grade).toBe("E");

    const d = (await foodDetail(u, stored.id))!;
    expect(d.food.per100.sodiumMg).toBeUndefined();
    expect(d.food.provenance.sodiumMg).toBeUndefined();
    expect(d.flags.map((f) => f.text).join(" ")).not.toMatch(/sodium/i); // no "24530% of your daily sodium limit"
    // Provisional: neither the stale E nor a kinder grade computed without sodium.
    const reason = "Sodium on this label isn't plausible, so we can't grade it.";
    expect(d.food.grade).toBe("?");
    expect(d.gradeUnavailable).toBe(reason);
    expect(d.reasons).toEqual([{ tone: "warn", text: reason }]); // no "Nothing stands out"
    expect(d.alternatives).toEqual([]);

    const hit = (await searchFoods(u, "dal makhani", "IN")).find((h) => h.id === stored.id)!;
    expect(hit.grade).toBe("?");
    expect((await findFoodByBarcode("8906000000001"))!.per100.sodiumMg).toBeUndefined();
    expect((await searchFoodRows(u, "dal makhani", "IN")).find((r) => r.id === stored.id)!.per100.sodiumMg).toBeUndefined();
    expect((await getFoodForUser(u, stored.id))!.per100.sodiumMg).toBeUndefined();
  });

  it("leaves out stored rows whose energy or macros are impossible (search, food page, barcode, alternatives) but never a custom food", async () => {
    const u = await createUser();
    // An OFF unit error stored before the bounds existed: fat 3,227 g per 100 g. Required values can't be dropped, so the row is hidden.
    const draft = toFoodDraft({ source: "off", sourceRef: "8906000000002", barcode: "8906000000002", name: "Ghee biscuits broken", basis: "per_100g",
      per100: { energyKcal: 480, protein: 6, carbs: 60, fat: 22 }, portions: [], categories: ["en:biscuits"], countries: ["IN"] }, rules);
    const bad = await upsertFood({ ...draft, per100: { ...draft.per100, fat: 3227 }, grade: "C" });
    const good = await upsertFood({ ...toFoodDraft({ source: "off", sourceRef: "8906000000003", barcode: "8906000000003", name: "Ghee biscuits", basis: "per_100g",
      per100: { energyKcal: 480, protein: 6, carbs: 60, fat: 22 }, portions: [], categories: ["en:biscuits"], countries: ["IN"] }, rules), grade: "A" });

    expect((await searchFoods(u, "ghee biscuits", "IN")).map((h) => h.id)).toEqual([good.id]);
    expect((await searchFoodRows(u, "ghee biscuits", "IN")).map((r) => r.id)).toEqual([good.id]);
    expect(await getFoodForUser(u, bad.id)).toBeNull();
    expect(await foodDetail(u, bad.id)).toBeNull();
    expect(await findFoodByBarcode("8906000000002")).toBeNull();
    expect(await findAlternatives(u, { categories: ["en:biscuits"], country: "IN", grade: "E" })).toHaveLength(1);

    // A custom food is the owner's own entry: 1,200 kcal per 100 g is past the bounds but stays visible to them.
    // (New custom foods can't be saved like that any more, so this is one stored before the check.)
    const mine = await createCustomFood(u, { name: "Ghee biscuits, home", per: { amount: 100, unit: "g" }, nutrients: { energyKcal: 800, protein: 6, carbs: 60, fat: 70 } });
    await db.update(food).set({ per100: { ...mine.per100, energyKcal: 1200 } }).where(eq(food.id, mine.id));
    expect(await getFoodForUser(u, mine.id)).not.toBeNull();
    expect((await searchFoods(u, "ghee biscuits", "IN")).map((h) => h.id)).toContain(mine.id);
  });

  it("corrects a stored pack default on read (OFF toor dal: 1 kg pack)", async () => {
    const u = await createUser();
    const draft = toFoodDraft({ source: "off", sourceRef: "8906000000004", name: "Toor Dal", brand: "Parry's", basis: "per_100g",
      per100: { energyKcal: 322, protein: 22, carbs: 57, fat: 1.5 }, portions: [{ label: "1 pack", amount: 1, unit: "pack", grams: 1000 }], countries: ["IN"] }, rules);
    expect(draft.portions[draft.defaultPortion ?? 0]!.label).toBe("100 g"); // new rows: never the pack
    const stored = await upsertFood({ ...draft, defaultPortion: 0 }); // as seeded before the rule
    const [hit] = await searchFoods(u, "toor dal", "IN");
    expect(hit).toMatchObject({ id: stored.id, defaultPortion: { label: "100 g", grams: 100 } });
    const f = (await getFoodForUser(u, stored.id))!;
    expect(f.portions[f.defaultPortion]!.label).toBe("100 g");
  });

  it("alternatives skip a row whose stored grade is better but whose effective grade is unavailable", async () => {
    const u = await createUser();
    const off = (ref: string, name: string, per100: Record<string, number>) => toFoodDraft({ source: "off", sourceRef: ref, barcode: ref, name, basis: "per_100g",
      per100: per100 as never, portions: [], categories: ["en:instant-noodles"], countries: ["IN"] }, rules);
    const subject = await upsertFood(off("8906100000001", "Masala noodles", { energyKcal: 450, protein: 9, carbs: 60, fat: 20, satFat: 9, sugars: 3, sodiumMg: 1400 }));
    expect(subject.grade! > "B").toBe(true);
    // Stored as A before the bounds; its sodium is a unit error (1,259,300 mg), so its effective grade is "?".
    const staleA = off("8906100000002", "Atta noodles", { energyKcal: 350, protein: 12, carbs: 60, fat: 5, satFat: 1, sugars: 2, sodiumMg: 100 });
    const stale = await upsertFood({ ...staleA, per100: { ...staleA.per100, sodiumMg: 1_259_300 }, grade: "A" });
    const real = await upsertFood(off("8906100000003", "Oats noodles", { energyKcal: 350, protein: 12, carbs: 60, fat: 5, satFat: 1, sugars: 2, sodiumMg: 100 }));
    const alts = await findAlternatives(u, { categories: ["en:instant-noodles"], country: "IN", grade: subject.grade as never, excludeId: subject.id });
    expect(alts.map((a) => a.id)).toContain(real.id);
    expect(alts.map((a) => a.id)).not.toContain(stale.id);
  });

  it("custom foods: implausible numbers are rejected with the field and a message; the edit form reads the stored row unguarded", async () => {
    const u = await createUser();
    const input = { name: "Jaggery bar", per: { amount: 100, unit: "g" as const }, nutrients: { energyKcal: 380, protein: 1, carbs: 30, fat: 1, sugars: 45 } };
    const parsed = CustomFoodSchema.safeParse(input);
    expect(parsed.success).toBe(false);
    expect(customFoodFieldError(parsed.error!)).toEqual({ field: "sugars", message: "Sugars can't be more than carbs." });
    await expect(createCustomFood(u, input)).rejects.toThrow();
    expect(CustomFoodSchema.safeParse({ ...input, nutrients: { ...input.nutrients, carbs: 90 } }).success).toBe(true);

    // A custom food stored before the bounds with an implausible value: the food page hides it, the edit form doesn't.
    const ok = await createCustomFood(u, { ...input, nutrients: { ...input.nutrients, carbs: 90, addedSugars: 10 } });
    await db.update(food).set({ per100: { ...ok.per100, sodiumMg: 90_000 } }).where(eq(food.id, ok.id));
    expect((await getFoodForUser(u, ok.id))!.per100.sodiumMg).toBeUndefined();
    const raw = (await getOwnCustomFoodForEdit(u, ok.id))!;
    expect(raw.per100.sodiumMg).toBe(90_000);
    expect(raw.per100.addedSugars).toBe(10); // kept through the schema (not on the form, carried by an edit)
    const other = await createUser();
    expect(await getOwnCustomFoodForEdit(other, ok.id)).toBeNull();
  });
});
