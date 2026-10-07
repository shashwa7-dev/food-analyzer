import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createUser, resetDb, testDb } from "@/tests/helpers/db";
import { profile } from "@/lib/db/schema";
import { ensureProfile } from "@/lib/profile/service";

const session = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/lib/session", () => ({
  requireUser: async () => ({ userId: session.userId, email: "t@example.com", name: "T", profile: await ensureProfile(session.userId) }),
}));
vi.mock("@/lib/auth", () => ({ auth: { api: {} } }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { saveProfile } = await import("./actions");
const stored = async () => (await testDb().select().from(profile).where(eq(profile.userId, session.userId)))[0]!;

describe("saveProfile and custom targets", () => {
  beforeEach(async () => {
    await resetDb();
    session.userId = await createUser(); // Basic plan
    // Set before Pro launched (gates off).
    await testDb().update(profile).set({ targets: { protein: 90 } }).where(eq(profile.userId, session.userId));
  });
  afterEach(() => vi.unstubAllEnvs());

  it("gates off: any custom targets save", async () => {
    vi.stubEnv("PRO_GATES_ENFORCED", "");
    expect(await saveProfile({ goal: "general", targets: { protein: 120 }, onboarded: true })).toEqual({ ok: true });
    expect((await stored()).targets).toEqual({ protein: 120 });
  });

  it("gates on, Basic: a redone onboarding finishes whether it omits targets or re-sends the stored ones", async () => {
    vi.stubEnv("PRO_GATES_ENFORCED", "true");
    expect(await saveProfile({ goal: "muscle", diet: "none", allergies: [], onboarded: true })).toEqual({ ok: true });
    expect(await saveProfile({ goal: "muscle", targets: { protein: 90 }, onboarded: true })).toEqual({ ok: true });
    const p = await stored();
    expect(p.goal).toBe("muscle");
    expect(p.targets).toEqual({ protein: 90 });
    expect(p.onboardedAt).not.toBeNull();
  });

  it("gates on, Basic: the goal's preset values or null go back to the preset", async () => {
    vi.stubEnv("PRO_GATES_ENFORCED", "true");
    expect(await saveProfile({ goal: "low_sodium", targets: { sodiumMgMax: 1500 } })).toEqual({ ok: true });
    expect((await stored()).targets).toBeNull();
    await testDb().update(profile).set({ targets: { protein: 90 } }).where(eq(profile.userId, session.userId));
    expect(await saveProfile({ targets: null })).toEqual({ ok: true });
    expect((await stored()).targets).toBeNull();
  });

  it("gates on, Basic: a deliberate change to custom targets is rejected and nothing is written", async () => {
    vi.stubEnv("PRO_GATES_ENFORCED", "true");
    expect(await saveProfile({ goal: "weight_loss", targets: { protein: 120 } })).toEqual({ ok: false, message: "Custom targets are part of Pro." });
    const p = await stored();
    expect(p.targets).toEqual({ protein: 90 });
    expect(p.goal).toBe("general");
  });

  it("gates on, Pro: custom targets save", async () => {
    vi.stubEnv("PRO_GATES_ENFORCED", "true");
    await testDb().update(profile).set({ plan: "pro" }).where(eq(profile.userId, session.userId));
    expect(await saveProfile({ targets: { protein: 130 } })).toEqual({ ok: true });
    expect((await stored()).targets).toEqual({ protein: 130 });
  });
});
