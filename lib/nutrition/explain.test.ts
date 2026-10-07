import { describe, expect, it } from "vitest";
import { droppedReason, explain, INDB_SODIUM_REASON } from "./explain";
import type { GradeResult } from "./types";
import { nutriScore } from "./grade/packaged";
import { PRESETS } from "./targets";

describe("explain", () => {
  it("leads with the biggest negative and caps at 3", () => {
    const per100 = { energyKcal: 560, protein: 11, carbs: 42, fat: 38, sugars: 2, satFat: 11, sodiumMg: 1050, fibre: 4 };
    const reasons = explain({ grade: nutriScore({ category: "general", per100 }), per100, basis: "per_100g", targets: PRESETS.general });
    expect(reasons.length).toBeLessThanOrEqual(3);
    expect(reasons[0]).toMatchObject({ tone: "bad" });
    expect(reasons[0]!.text).toMatch(/salt|sodium/i);
  });
  it("includes a positive reason for good foods", () => {
    const per100 = { energyKcal: 370, protein: 19, carbs: 58, fat: 6, sugars: 8, satFat: 0.7, sodiumMg: 25, fibre: 17 };
    const reasons = explain({ grade: nutriScore({ category: "general", per100 }), per100, basis: "per_100g", targets: PRESETS.general });
    expect(reasons.some((r) => r.tone === "good" && /protein|fibre/i.test(r.text))).toBe(true);
  });
  it("explains dish density penalties without duplicate reasons", async () => {
    const { dishScore } = await import("./grade/dish");
    const per100 = { energyKcal: 520, protein: 12, carbs: 60, fat: 25, sugars: 44 };
    const reasons = explain({ grade: dishScore(per100, per100), per100, basis: "per_100g", targets: PRESETS.general });
    expect(reasons.some((r) => /High sugar: 44 g per 100 g/.test(r.text))).toBe(true);
    expect(new Set(reasons.map((r) => r.text)).size).toBe(reasons.length);
  });
  it("warns that INDB savoury dishes may not count cooking salt", () => {
    const per100 = { energyKcal: 120, protein: 6, carbs: 14, fat: 4.5, sodiumMg: 40 };
    const grade = { grade: "A" as const, value: 95, components: [] };
    const base = { grade, per100, basis: "per_100g" as const, targets: PRESETS.general };
    expect(explain({ ...base, source: "indb", name: "Dal makhani" }).at(-1)).toEqual({ tone: "warn", text: INDB_SODIUM_REASON });
    expect(explain({ ...base, source: "indb", name: "Gulab jamun" }).some((r) => r.text === INDB_SODIUM_REASON)).toBe(false);
    expect(explain({ ...base, source: "fndds", name: "Dal" }).some((r) => r.text === INDB_SODIUM_REASON)).toBe(false);
    expect(explain({ ...base, per100: { ...per100, sodiumMg: 400 }, source: "indb", name: "Dal makhani" }).some((r) => r.text === INDB_SODIUM_REASON)).toBe(false);
  });
  it("returns an honest note for ungraded foods", () => {
    expect(explain({ grade: { grade: null, value: null, components: [] }, per100: { energyKcal: 900, protein: 0, carbs: 0, fat: 100 }, basis: "per_100g", targets: PRESETS.general }))
      .toEqual([{ tone: "warn", text: "Cooking ingredient — not graded on its own." }]);
  });
});

describe("droppedReason (the regrade note)", () => {
  const comp = (key: string) => ({ key, label: key, points: 0, maxPoints: 10, direction: "negative" as const, estimated: true });
  const graded = (...keys: string[]): GradeResult => ({ grade: "B", value: 2, components: keys.map(comp) });

  it("names a dropped value the grade would have counted", () => {
    expect(droppedReason(graded("salt", "sugars"), ["sodiumMg"])).toEqual({ tone: "warn", text: "Sodium left out: the source's figure wasn't plausible, so this grade doesn't count it." });
    expect(droppedReason(graded("sodiumDensity"), ["sodiumMg"])?.text).toMatch(/^Sodium left out/); // dish scoring
    expect(droppedReason(graded("salt", "sugars", "satFat"), ["sugars", "satFat", "sodiumMg"])?.text).toMatch(/^Sugar, saturated fat and sodium left out/);
  });

  it("says nothing when nothing was dropped, or the grade doesn't use the dropped value", () => {
    expect(droppedReason(graded("salt"), undefined)).toBeNull();
    expect(droppedReason(graded("salt"), [])).toBeNull();
    expect(droppedReason(graded("energy"), ["sodiumMg"])).toBeNull();
    expect(droppedReason({ grade: null, value: null, components: [] }, ["sodiumMg"])).toBeNull();
  });

  it("explain appends it after the grade's own reasons", () => {
    const r = explain({ grade: graded("salt"), per100: { energyKcal: 129, protein: 4, carbs: 12, fat: 7 }, basis: "per_100g", targets: PRESETS.general, dropped: ["sodiumMg"] });
    expect(r.map((x) => x.text)).toEqual(["Nothing stands out as too high.", "Sodium left out: the source's figure wasn't plausible, so this grade doesn't count it."]);
  });
});
