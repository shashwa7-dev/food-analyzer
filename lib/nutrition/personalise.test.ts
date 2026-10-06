import { describe, expect, it } from "vitest";
import { personalise } from "./personalise";
import { PRESETS } from "./targets";

const prof = (o: Partial<{ allergies: string[]; diet: "none" | "vegetarian" | "eggetarian" | "vegan" | "jain"; goal: "general" | "low_sodium" }>) =>
  ({ allergies: [], diet: "none" as const, goal: "general" as const, targets: PRESETS.general, ...o, ...(o.goal ? { targets: PRESETS[o.goal] } : {}) });
const portion = { energyKcal: 168, protein: 3.3, carbs: 12.6, fat: 11.4, sodiumMg: 315 };

describe("personalise", () => {
  it("flags allergens from declared tags and Hinglish ingredient names", () => {
    const f = personalise({ allergens: ["en:milk"], ingredients: ["gram flour", "groundnut oil", "maida"], perPortion: portion, portionLabel: "1 bowl", profile: prof({ allergies: ["peanut", "gluten", "milk"] }) });
    expect(f.filter((x) => x.type === "allergen").map((x) => x.key).sort()).toEqual(["gluten", "milk", "peanut"]);
    expect(f.every((x) => x.text.endsWith("Check the pack to confirm."))).toBe(true);
  });
  it("uses may_contain for trace warnings", () => {
    const f = personalise({ allergens: [], ingredients: [], mayContain: ["en:peanuts"], perPortion: portion, portionLabel: "1 bowl", profile: prof({ allergies: ["peanut"] }) });
    expect(f[0]).toMatchObject({ key: "peanut", severity: "may_contain" });
  });
  it("applies diet rules", () => {
    expect(personalise({ allergens: [], ingredients: ["onion", "garlic"], perPortion: portion, portionLabel: "1 bowl", profile: prof({ diet: "jain" }) }).some((x) => x.type === "diet")).toBe(true);
    expect(personalise({ allergens: [], ingredients: ["ghee", "wheat"], perPortion: portion, portionLabel: "1 bowl", profile: prof({ diet: "vegan" }) }).some((x) => x.type === "diet")).toBe(true);
    expect(personalise({ allergens: [], ingredients: ["egg"], perPortion: portion, portionLabel: "1 bowl", profile: prof({ diet: "eggetarian" }) }).some((x) => x.type === "diet")).toBe(false);
  });
  it("adds a goal note when a portion uses > 20% of a limit", () => {
    const f = personalise({ allergens: [], ingredients: [], perPortion: portion, portionLabel: "1 small bowl", profile: prof({ goal: "low_sodium" }) });
    expect(f.find((x) => x.type === "goal")?.text).toMatch(/21% of your daily sodium limit/);
  });
  it("adds no flags when ingredients are unknown and nothing is over", () => {
    expect(personalise({ allergens: [], ingredients: [], perPortion: { energyKcal: 100, protein: 3, carbs: 10, fat: 2 }, portionLabel: "1 katori", profile: prof({}) })).toEqual([]);
  });
});
