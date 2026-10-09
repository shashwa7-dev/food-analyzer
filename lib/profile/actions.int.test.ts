import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createUser, resetDb, testDb } from "@/tests/helpers/db";
import { profile, foodLog, workout, workoutExercise, workoutSet, bodyWeight } from "@/lib/db/schema";
import { user } from "@/lib/db/auth-schema";
import { addEntry } from "@/lib/log/service";
import { createWorkout } from "@/lib/fitness/service";
import { logWeight } from "@/lib/fitness/weight";
import { deleteAccount, updateProfile } from "./service";

describe("profile updates", () => {
  beforeEach(resetDb);
  it("saves goal, diet, allergies and marks onboarded", async () => {
    const u = await createUser();
    await updateProfile(u, { goal: "low_sodium", diet: "vegetarian", allergies: ["peanut"], onboarded: true });
    const [p] = await testDb().select().from(profile).where(eq(profile.userId, u));
    expect(p).toMatchObject({ goal: "low_sodium", diet: "vegetarian", allergies: ["peanut"] });
    expect(p!.onboardedAt).not.toBeNull();
  });
  it("drops allergies the saved diet already excludes", async () => {
    const u = await createUser();
    await updateProfile(u, { diet: "vegetarian", allergies: ["fish", "peanut"] });
    const [p] = await testDb().select().from(profile).where(eq(profile.userId, u));
    expect(p!.allergies).toEqual(["peanut"]);
  });
  it("drops now-hidden allergies when only the diet changes later", async () => {
    const u = await createUser();
    await updateProfile(u, { diet: "none", allergies: ["fish", "peanut"] });
    await updateProfile(u, { diet: "vegan" });
    const [p] = await testDb().select().from(profile).where(eq(profile.userId, u));
    expect(p!.allergies).toEqual(["peanut"]);
  });
  it("rejects unknown allergens and bad targets", async () => {
    const u = await createUser();
    await expect(updateProfile(u, { allergies: ["glitter"] as never })).rejects.toThrow();
    await expect(updateProfile(u, { targets: { energyKcal: 10 } })).rejects.toThrow();
  });
  it("deleting the account removes the user and their diary", async () => {
    const u = await createUser();
    await addEntry(u, { kind: "quick", date: new Date().toISOString().slice(0, 10), meal: "snack", name: "Chai", nutrients: { energyKcal: 105, protein: 3, carbs: 15, fat: 3.3 } });
    await deleteAccount(u);
    expect(await testDb().select().from(user).where(eq(user.id, u))).toHaveLength(0);
    expect(await testDb().select().from(foodLog).where(eq(foodLog.userId, u))).toHaveLength(0);
  });
  it("deleting the account removes their workouts, sets and weight log", async () => {
    const u = await createUser();
    const today = new Date().toISOString().slice(0, 10);
    await logWeight(u, { date: today, kg: 72 });
    await createWorkout(u, { kind: "gym", date: today, preset: "push", title: "Push day", intensity: "moderate", durationMin: 40,
      exercises: [{ exerciseKey: "bench_press", name: "Bench press", sets: [{ weightKg: 60, reps: 8, done: true }] }] });
    const [w] = await testDb().select({ id: workout.id }).from(workout).where(eq(workout.userId, u));
    await deleteAccount(u);
    expect(await testDb().select().from(workout).where(eq(workout.userId, u))).toHaveLength(0);
    expect(await testDb().select().from(workoutExercise).where(eq(workoutExercise.workoutId, w!.id))).toHaveLength(0);
    expect(await testDb().select().from(bodyWeight).where(eq(bodyWeight.userId, u))).toHaveLength(0);
    expect(await testDb().select().from(workoutSet)).toHaveLength(0);
  });
});
