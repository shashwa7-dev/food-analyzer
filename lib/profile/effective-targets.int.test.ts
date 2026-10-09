import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createUser, resetDb, testDb } from "@/tests/helpers/db";
import { profile } from "@/lib/db/schema";
import { PRESETS } from "@/lib/nutrition/targets";
import { getDay } from "@/lib/log/service";
import { getProgress } from "@/lib/progress/service";

// Every server read of the targets goes through effectiveTargets: Today (getDay) and Progress here.
describe("effective targets at the read sites", () => {
  let userId = "";
  beforeEach(async () => {
    await resetDb();
    userId = await createUser(); // Basic
    await testDb().update(profile).set({ goal: "muscle", targets: { energyKcal: 2600 } }).where(eq(profile.userId, userId));
  });
  afterEach(() => vi.unstubAllEnvs());

  it("Basic, enforced: the goal's preset; the overrides stay stored", async () => {
    vi.stubEnv("PRO_GATES_ENFORCED", "true");
    expect((await getDay(userId, "2026-10-01")).targets).toEqual(PRESETS.muscle);
    expect((await getProgress(userId, "week")).targets).toEqual(PRESETS.muscle);
    const [row] = await testDb().select().from(profile).where(eq(profile.userId, userId));
    expect(row!.targets).toEqual({ energyKcal: 2600 });
  });

  it("Pro, enforced, and anyone with the gates off: the overrides apply", async () => {
    vi.stubEnv("PRO_GATES_ENFORCED", "");
    expect((await getDay(userId, "2026-10-01")).targets.energyKcal).toBe(2600);
    vi.stubEnv("PRO_GATES_ENFORCED", "true");
    await testDb().update(profile).set({ plan: "pro" }).where(eq(profile.userId, userId));
    expect((await getDay(userId, "2026-10-01")).targets.energyKcal).toBe(2600);
    expect((await getProgress(userId, "week")).targets.energyKcal).toBe(2600);
  });
});
