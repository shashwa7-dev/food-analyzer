import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createUser, resetDb, testDb } from "@/tests/helpers/db";
import { profile, foodLog } from "@/lib/db/schema";
import { user } from "@/lib/db/auth-schema";
import { addEntry } from "@/lib/log/service";
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
});
