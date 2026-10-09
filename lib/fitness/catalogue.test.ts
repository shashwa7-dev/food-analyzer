import { describe, expect, it } from "vitest";
import { ACTIVITIES, customExerciseKey, EXERCISES, exerciseByKey, PRESETS } from "./catalogue";
import { ACTIVITY_KEYS, PRESET_KEYS } from "./types";

describe("catalogue", () => {
  it("has about 40 exercises with unique keys and names", () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(40);
    expect(new Set(EXERCISES.map((e) => e.key)).size).toBe(EXERCISES.length);
    expect(new Set(EXERCISES.map((e) => e.name)).size).toBe(EXERCISES.length);
    for (const e of EXERCISES) expect(e.key).toMatch(/^[a-z_]+$/);
  });
  it("has the five presets, each with five catalogue exercises", () => {
    expect(Object.keys(PRESETS).sort()).toEqual([...PRESET_KEYS].sort());
    for (const p of Object.values(PRESETS)) {
      expect(p.exercises).toHaveLength(5);
      for (const key of p.exercises) expect(exerciseByKey(key), key).toBeDefined();
    }
    expect(PRESETS.push.exercises.map((k) => exerciseByKey(k)!.name)).toEqual(["Bench press", "Overhead press", "Incline DB press", "Lateral raise", "Triceps pushdown"]);
    expect(PRESETS.legs.exercises).toEqual(["squat", "romanian_deadlift", "leg_press", "leg_curl", "calf_raise"]);
  });
  it("has the five activities", () => {
    expect(Object.keys(ACTIVITIES).sort()).toEqual([...ACTIVITY_KEYS].sort());
  });
  it("keys custom exercises by their normalised name, never colliding with the catalogue", () => {
    expect(customExerciseKey("  Cable Kickback ")).toBe("custom:cable_kickback");
    expect(customExerciseKey("Landmine press!")).toBe("custom:landmine_press");
    expect(customExerciseKey("!!!")).toBe("custom:exercise");
    expect(exerciseByKey(customExerciseKey("Bench press"))).toBeUndefined();
  });
});
