import { beforeEach, describe, expect, it } from "vitest";
import { createUser, resetDb } from "@/tests/helpers/db";
import { upsertFoods } from "./insert";
import { toFoodDraft, parseHouseholdCsv } from "./seed-map";
import { createCustomFood, deleteCustomFood, foodDetail, getFoodForUser, myFoods, recentFoods, searchFoods, updateCustomFood } from "./service";

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

  it("ranks cooked foods above raw ingredients", async () => {
    const u = await createUser();
    const names = (await searchFoods(u, "rice", "IN")).map((h) => h.name);
    expect(names.indexOf("Rice, white, boiled")).toBeLessThan(names.indexOf("Rice, raw, milled"));
    expect(names.indexOf("Rice, white, boiled")).toBeLessThan(names.indexOf("Rice flour, raw"));
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
