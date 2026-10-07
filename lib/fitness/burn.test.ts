import { describe, expect, it } from "vitest";
import { kcalBurned, met } from "./burn";
describe("burn", () => {
  it("uses the spec's MET table", () => {
    expect(met("gym", "moderate")).toBe(5.0);
    expect(met("walk", "hard")).toBe(4.3);
    expect(met("run", "moderate")).toBe(9.8);
    expect(met("yoga", "easy")).toBe(2.5);
  });
  it("is MET × kg × hours, rounded", () => {
    expect(kcalBurned({ kind: "walk", intensity: "moderate", minutes: 35, weightKg: 72 })).toEqual({ kcal: 147, estimated: false, weightKg: 72, met: 3.5 });
  });
  it("estimates with 70 kg when no weight is logged", () => {
    expect(kcalBurned({ kind: "gym", intensity: "moderate", minutes: 48, weightKg: null })).toMatchObject({ kcal: 280, estimated: true, weightKg: 70 });
  });
  it("never returns NaN for zero or bad minutes", () => {
    expect(kcalBurned({ kind: "run", intensity: "easy", minutes: 0, weightKg: 70 }).kcal).toBe(0);
  });

  it("covers every MET cell in the spec's table", () => {
    const table = {
      gym: [3.5, 5.0, 6.0], walk: [2.8, 3.5, 4.3], run: [7.0, 9.8, 11.5],
      cycling: [5.8, 7.5, 10.0], yoga: [2.5, 3.0, 4.0], sport: [5.0, 7.0, 9.0],
    } as const;
    for (const [kind, values] of Object.entries(table)) {
      (["easy", "moderate", "hard"] as const).forEach((intensity, i) => {
        expect(met(kind as keyof typeof table, intensity)).toBe(values[i]);
        // One hour at 100 kg is MET × 100.
        expect(kcalBurned({ kind: kind as keyof typeof table, intensity, minutes: 60, weightKg: 100 }).kcal).toBe(Math.round(values[i] * 100));
      });
    }
  });
  it("treats NaN, negative minutes and a non-positive weight safely", () => {
    expect(kcalBurned({ kind: "run", intensity: "easy", minutes: Number.NaN, weightKg: 70 }).kcal).toBe(0);
    expect(kcalBurned({ kind: "run", intensity: "easy", minutes: -10, weightKg: 70 }).kcal).toBe(0);
    expect(kcalBurned({ kind: "walk", intensity: "easy", minutes: 60, weightKg: 0 })).toMatchObject({ estimated: true, weightKg: 70, kcal: 196 });
  });
});
