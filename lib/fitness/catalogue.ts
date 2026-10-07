// The static exercise catalogue, gym presets and activities (spec §C "Catalogue"). Workouts store an
// exercise's key and a snapshot of its name; custom exercises get a `custom:<slug>` key from their name.
import type { Activity, Preset } from "@/lib/fitness/types";

export type MuscleGroup = "chest" | "back" | "legs" | "shoulders" | "arms" | "core";
export type Equipment = "barbell" | "dumbbell" | "cable" | "machine" | "bodyweight";
export type Exercise = { key: string; name: string; group: MuscleGroup; equipment: Equipment };

export const EXERCISES: Exercise[] = [
  // Chest
  { key: "bench_press", name: "Bench press", group: "chest", equipment: "barbell" },
  { key: "incline_bench_press", name: "Incline bench press", group: "chest", equipment: "barbell" },
  { key: "incline_db_press", name: "Incline DB press", group: "chest", equipment: "dumbbell" },
  { key: "db_bench_press", name: "DB bench press", group: "chest", equipment: "dumbbell" },
  { key: "chest_fly", name: "Chest fly", group: "chest", equipment: "dumbbell" },
  { key: "cable_crossover", name: "Cable crossover", group: "chest", equipment: "cable" },
  { key: "chest_press_machine", name: "Chest press machine", group: "chest", equipment: "machine" },
  { key: "push_up", name: "Push-up", group: "chest", equipment: "bodyweight" },
  { key: "dip", name: "Dip", group: "chest", equipment: "bodyweight" },
  // Back
  { key: "deadlift", name: "Deadlift", group: "back", equipment: "barbell" },
  { key: "lat_pulldown", name: "Lat pulldown", group: "back", equipment: "cable" },
  { key: "pull_up", name: "Pull-up", group: "back", equipment: "bodyweight" },
  { key: "chin_up", name: "Chin-up", group: "back", equipment: "bodyweight" },
  { key: "barbell_row", name: "Barbell row", group: "back", equipment: "barbell" },
  { key: "seated_cable_row", name: "Seated cable row", group: "back", equipment: "cable" },
  { key: "single_arm_db_row", name: "Single-arm DB row", group: "back", equipment: "dumbbell" },
  { key: "straight_arm_pulldown", name: "Straight-arm pulldown", group: "back", equipment: "cable" },
  { key: "back_extension", name: "Back extension", group: "back", equipment: "bodyweight" },
  { key: "t_bar_row", name: "T-bar row", group: "back", equipment: "barbell" },
  // Legs
  { key: "squat", name: "Squat", group: "legs", equipment: "barbell" },
  { key: "front_squat", name: "Front squat", group: "legs", equipment: "barbell" },
  { key: "romanian_deadlift", name: "Romanian deadlift", group: "legs", equipment: "barbell" },
  { key: "leg_press", name: "Leg press", group: "legs", equipment: "machine" },
  { key: "leg_curl", name: "Leg curl", group: "legs", equipment: "machine" },
  { key: "leg_extension", name: "Leg extension", group: "legs", equipment: "machine" },
  { key: "calf_raise", name: "Calf raise", group: "legs", equipment: "machine" },
  { key: "walking_lunge", name: "Walking lunge", group: "legs", equipment: "dumbbell" },
  { key: "bulgarian_split_squat", name: "Bulgarian split squat", group: "legs", equipment: "dumbbell" },
  { key: "hip_thrust", name: "Hip thrust", group: "legs", equipment: "barbell" },
  { key: "goblet_squat", name: "Goblet squat", group: "legs", equipment: "dumbbell" },
  // Shoulders
  { key: "overhead_press", name: "Overhead press", group: "shoulders", equipment: "barbell" },
  { key: "db_shoulder_press", name: "DB shoulder press", group: "shoulders", equipment: "dumbbell" },
  { key: "arnold_press", name: "Arnold press", group: "shoulders", equipment: "dumbbell" },
  { key: "lateral_raise", name: "Lateral raise", group: "shoulders", equipment: "dumbbell" },
  { key: "rear_delt_fly", name: "Rear-delt fly", group: "shoulders", equipment: "dumbbell" },
  { key: "face_pull", name: "Face pull", group: "shoulders", equipment: "cable" },
  { key: "upright_row", name: "Upright row", group: "shoulders", equipment: "barbell" },
  { key: "shrug", name: "Shrug", group: "shoulders", equipment: "dumbbell" },
  // Arms
  { key: "biceps_curl", name: "Biceps curl", group: "arms", equipment: "dumbbell" },
  { key: "barbell_curl", name: "Barbell curl", group: "arms", equipment: "barbell" },
  { key: "hammer_curl", name: "Hammer curl", group: "arms", equipment: "dumbbell" },
  { key: "triceps_pushdown", name: "Triceps pushdown", group: "arms", equipment: "cable" },
  { key: "skull_crusher", name: "Skull crusher", group: "arms", equipment: "barbell" },
  { key: "overhead_triceps_extension", name: "Overhead triceps extension", group: "arms", equipment: "dumbbell" },
  // Core
  { key: "plank", name: "Plank", group: "core", equipment: "bodyweight" },
  { key: "hanging_leg_raise", name: "Hanging leg raise", group: "core", equipment: "bodyweight" },
  { key: "cable_crunch", name: "Cable crunch", group: "core", equipment: "cable" },
];

const BY_KEY = new Map(EXERCISES.map((e) => [e.key, e]));
export const exerciseByKey = (key: string): Exercise | undefined => BY_KEY.get(key);

export const PRESETS: Record<Preset, { title: string; muscles: string; exercises: string[] }> = {
  push: { title: "Push", muscles: "Chest · Shoulders · Triceps", exercises: ["bench_press", "overhead_press", "incline_db_press", "lateral_raise", "triceps_pushdown"] },
  pull: { title: "Pull", muscles: "Back · Biceps", exercises: ["deadlift", "barbell_row", "seated_cable_row", "face_pull", "biceps_curl"] },
  legs: { title: "Legs", muscles: "Quads · Hamstrings · Calves", exercises: ["squat", "romanian_deadlift", "leg_press", "leg_curl", "calf_raise"] },
  back: { title: "Back", muscles: "Lats · Upper back", exercises: ["pull_up", "barbell_row", "single_arm_db_row", "straight_arm_pulldown", "back_extension"] },
  shoulders: { title: "Shoulders", muscles: "Delts · Traps", exercises: ["overhead_press", "lateral_raise", "rear_delt_fly", "arnold_press", "shrug"] },
};

export const ACTIVITIES: Record<Activity, { title: string }> = {
  walk: { title: "Walk" },
  run: { title: "Run" },
  cycling: { title: "Cycling" },
  yoga: { title: "Yoga" },
  sport: { title: "Sport" },
};

/** The key a custom exercise is stored under: `custom:` plus its name lowercased, non-alphanumerics as "_". */
export function customExerciseKey(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "").slice(0, 60);
  return `custom:${slug || "exercise"}`;
}
