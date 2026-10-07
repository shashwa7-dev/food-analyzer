import { describe, expect, it } from "vitest";
import { PRESETS, TargetsSchema, targetsFor } from "./targets";

describe("targets", () => {
  it("general preset matches the spec", () => {
    expect(PRESETS.general).toEqual({ energyKcal: 2000, protein: 60, carbs: 275, fat: 67, fibre: 30, sugarsMax: 50, sodiumMgMax: 2000, satFatMax: 22 });
  });
  it("goal presets change only their own levers", () => {
    expect(PRESETS.low_sodium.sodiumMgMax).toBe(1500);
    expect(PRESETS.low_sugar.sugarsMax).toBe(25);
    expect(PRESETS.muscle.protein).toBe(100);
    expect(PRESETS.weight_loss.energyKcal).toBe(1700);
    expect(PRESETS.low_sodium.energyKcal).toBe(2000);
  });
  it("overrides win and nulls fall back", () => {
    expect(targetsFor("general", { protein: 80 }).protein).toBe(80);
    expect(targetsFor("general", null).protein).toBe(60);
  });
  it("rejects absurd overrides", () => {
    expect(TargetsSchema.safeParse({ energyKcal: 50 }).success).toBe(false);
    expect(TargetsSchema.safeParse({ energyKcal: 1800, protein: 120 }).success).toBe(true);
  });
});
