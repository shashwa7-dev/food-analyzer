import { describe, expect, it } from "vitest";
import { personalise } from "./personalise";
import { PRESETS } from "./targets";

const prof = (o: Partial<{ allergies: string[]; diet: "none" | "vegetarian" | "eggetarian" | "vegan" | "jain"; goal: "general" | "low_sodium" }>) =>
  ({ allergies: [], diet: "none" as const, goal: "general" as const, targets: PRESETS.general, ...o, ...(o.goal ? { targets: PRESETS[o.goal] } : {}) });
const portion = { energyKcal: 168, protein: 3.3, carbs: 12.6, fat: 11.4, sodiumMg: 315 };

describe("personalise", () => {
  it("flags allergens from declared tags and Hinglish ingredient names", () => {
    const f = personalise({ name: "Test food", allergens: ["en:milk"], ingredients: ["gram flour", "groundnut oil", "maida"], perPortion: portion, portionLabel: "1 bowl", profile: prof({ allergies: ["peanut", "gluten", "milk"] }) });
    expect(f.filter((x) => x.type === "allergen").map((x) => x.key).sort()).toEqual(["gluten", "milk", "peanut"]);
    expect(f.every((x) => x.text.endsWith("Check the pack to confirm."))).toBe(true);
  });
  it("uses may_contain for trace warnings", () => {
    const f = personalise({ name: "Test food", allergens: [], ingredients: [], mayContain: ["en:peanuts"], perPortion: portion, portionLabel: "1 bowl", profile: prof({ allergies: ["peanut"] }) });
    expect(f[0]).toMatchObject({ key: "peanut", severity: "may_contain" });
  });
  it("applies diet rules", () => {
    expect(personalise({ name: "Test food", allergens: [], ingredients: ["onion", "garlic"], perPortion: portion, portionLabel: "1 bowl", profile: prof({ diet: "jain" }) }).some((x) => x.type === "diet")).toBe(true);
    expect(personalise({ name: "Test food", allergens: [], ingredients: ["ghee", "wheat"], perPortion: portion, portionLabel: "1 bowl", profile: prof({ diet: "vegan" }) }).some((x) => x.type === "diet")).toBe(true);
    expect(personalise({ name: "Test food", allergens: [], ingredients: ["egg"], perPortion: portion, portionLabel: "1 bowl", profile: prof({ diet: "eggetarian" }) }).some((x) => x.type === "diet")).toBe(false);
  });
  it("adds a goal note when a portion uses > 20% of a limit", () => {
    const f = personalise({ name: "Test food", allergens: [], ingredients: [], perPortion: portion, portionLabel: "1 small bowl", profile: prof({ goal: "low_sodium" }) });
    expect(f.find((x) => x.type === "goal")?.text).toMatch(/21% of your daily sodium limit/);
  });
  it("adds no flags when ingredients are unknown and nothing is over", () => {
    expect(personalise({ name: "Test food", allergens: [], ingredients: [], perPortion: { energyKcal: 100, protein: 3, carbs: 10, fat: 2 }, portionLabel: "1 katori", profile: prof({}) })).toEqual([]);
  });
  it("flags yogurt and buttermilk as milk allergen", () => {
    const f1 = personalise({ name: "Test food", allergens: [], ingredients: ["yogurt"], perPortion: portion, portionLabel: "1 bowl", profile: prof({ allergies: ["milk"] }) });
    expect(f1.some((x) => x.type === "allergen" && x.key === "milk")).toBe(true);
    const f2 = personalise({ name: "Test food", allergens: [], ingredients: ["buttermilk"], perPortion: portion, portionLabel: "1 bowl", profile: prof({ allergies: ["milk"] }) });
    expect(f2.some((x) => x.type === "allergen" && x.key === "milk")).toBe(true);
  });
  it("flags yogurt and buttermilk as vegan violations", () => {
    const f1 = personalise({ name: "Test food", allergens: [], ingredients: ["yogurt"], perPortion: portion, portionLabel: "1 bowl", profile: prof({ diet: "vegan" }) });
    expect(f1.some((x) => x.type === "diet")).toBe(true);
    const f2 = personalise({ name: "Test food", allergens: [], ingredients: ["buttermilk"], perPortion: portion, portionLabel: "1 bowl", profile: prof({ diet: "vegan" }) });
    expect(f2.some((x) => x.type === "diet")).toBe(true);
  });
  it("flags shellfish as vegetarian violation", () => {
    const f = personalise({ name: "Test food", allergens: [], ingredients: ["shellfish"], perPortion: portion, portionLabel: "1 bowl", profile: prof({ diet: "vegetarian" }) });
    expect(f.some((x) => x.type === "diet")).toBe(true);
  });
  it("does not flag lentil as sesame (til word boundary test)", () => {
    const f = personalise({ name: "Test food", allergens: [], ingredients: ["lentil"], perPortion: portion, portionLabel: "1 bowl", profile: prof({ allergies: ["sesame"] }) });
    expect(f.filter((x) => x.type === "allergen").length).toBe(0);
  });
  it("does not flag grain as mustard (rai word boundary test)", () => {
    const f = personalise({ name: "Test food", allergens: [], ingredients: ["grain"], perPortion: portion, portionLabel: "1 bowl", profile: prof({ allergies: ["mustard"] }) });
    expect(f.filter((x) => x.type === "allergen").length).toBe(0);
  });
  describe("when ingredients are unknown", () => {
    const base = { allergens: [], ingredients: [], perPortion: { energyKcal: 100, protein: 3, carbs: 10, fat: 2 }, portionLabel: "1 bowl" };
    it("flags milk in Paneer butter masala by name", () => {
      const f = personalise({ ...base, name: "Paneer butter masala", profile: prof({ allergies: ["milk"] }) });
      expect(f.find((x) => x.key === "milk")).toMatchObject({ type: "allergen", severity: "contains" });
    });
    it("flags peanut in Moongfali chikki by name", () => {
      const f = personalise({ ...base, name: "Moongfali chikki", profile: prof({ allergies: ["peanut"] }) });
      expect(f.some((x) => x.key === "peanut" && x.severity === "contains")).toBe(true);
    });
    it("applies diet rules to the name", () => {
      expect(personalise({ ...base, name: "Chicken curry", profile: prof({ diet: "vegetarian" }) }).some((x) => x.type === "diet" && x.severity === "contains")).toBe(true);
    });
    it("does not read peanut butter or coconut milk as dairy", () => {
      expect(personalise({ ...base, name: "Peanut butter", profile: prof({ allergies: ["milk"] }) }).some((x) => x.key === "milk")).toBe(false);
      expect(personalise({ ...base, name: "Coconut milk curry", profile: prof({ diet: "vegan" }) }).some((x) => x.type === "diet")).toBe(false);
    });
    const allergyKeys = (name: string, allergies: string[]) =>
      personalise({ ...base, name, profile: prof({ allergies }) }).filter((x) => x.type === "allergen" && x.severity === "contains").map((x) => x.key).sort();
    it("strips plant milks/butters only for the dairy check", () => {
      expect(allergyKeys("Peanut butter", ["peanut", "milk"])).toEqual(["peanut"]);
      expect(allergyKeys("Almond milk", ["tree_nut", "milk"])).toEqual(["tree_nut"]);
      expect(allergyKeys("Cashew butter", ["tree_nut"])).toEqual(["tree_nut"]);
      expect(allergyKeys("Soy milk", ["soy", "milk"])).toEqual(["soy"]);
      expect(allergyKeys("Paneer butter masala", ["milk"])).toEqual(["milk"]);
      expect(personalise({ ...base, name: "Peanut butter", profile: prof({ diet: "vegan" }) }).some((x) => x.type === "diet")).toBe(false);
    });
    it("flags peanut for the OFF product name 'Peanut Butter Creamy'", () => {
      expect(allergyKeys("Peanut Butter Creamy", ["peanut", "milk"])).toEqual(["peanut"]);
    });
    it("checks the name for allergens even when ingredients are listed", () => {
      const f = personalise({ ...base, ingredients: ["100% TURAL D"], name: "Peanut Butter All Natural Creamy Unsweetened", profile: prof({ allergies: ["peanut", "milk"] }) });
      expect(f.filter((x) => x.type === "allergen").map((x) => x.key)).toEqual(["peanut"]);
    });
    it("does not apply diet rules to the name when ingredients are listed", () => {
      const f = personalise({ ...base, ingredients: ["potato", "oil", "flavouring"], name: "Chicken flavoured crisps", profile: prof({ diet: "vegetarian" }) });
      expect(f.some((x) => x.type === "diet")).toBe(false);
    });
    it("adds an unknown-ingredients note only when the user has allergies or a diet", () => {
      const note = { type: "allergen", key: "unknown", severity: "note", text: "Ingredients unknown — check before eating." };
      expect(personalise({ ...base, name: "Plain dosa", profile: prof({ allergies: ["sesame"] }) })).toContainEqual(note);
      expect(personalise({ ...base, name: "Plain dosa", profile: prof({ diet: "jain" }) })).toContainEqual(note);
      expect(personalise({ ...base, name: "Plain dosa", profile: prof({}) })).toEqual([]);
      expect(personalise({ ...base, ingredients: ["rice", "urad dal"], name: "Plain dosa", profile: prof({ allergies: ["sesame"] }) })).toEqual([]);
    });
  });
});
