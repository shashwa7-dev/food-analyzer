import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { resetDb, testDb } from "@/tests/helpers/db";
import { user } from "@/lib/db/auth-schema";
import { profile } from "@/lib/db/schema";
import { ensureProfile, updateTimezone } from "./service";

async function bareUser(id: string) {
  await testDb().insert(user).values({ id, name: "A", email: `${id}@x.com`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() });
}

describe("ensureProfile", () => {
  beforeEach(resetDb);
  it("creates a profile once and is idempotent", async () => {
    await bareUser("u1");
    const a = await ensureProfile("u1");
    const b = await ensureProfile("u1");
    expect(a.userId).toBe("u1");
    expect(b.userId).toBe("u1");
    const rows = await testDb().select().from(profile).where(eq(profile.userId, "u1"));
    expect(rows).toHaveLength(1);
  });
  it("is safe under concurrent calls", async () => {
    await bareUser("u2");
    await Promise.all([ensureProfile("u2"), ensureProfile("u2"), ensureProfile("u2")]);
    const rows = await testDb().select().from(profile).where(eq(profile.userId, "u2"));
    expect(rows).toHaveLength(1);
  });
  it("only stores valid IANA timezones", async () => {
    await bareUser("u3");
    await ensureProfile("u3");
    await updateTimezone("u3", "Not/AZone");
    expect((await ensureProfile("u3")).timezone).toBe("Asia/Kolkata");
    await updateTimezone("u3", "Europe/London");
    expect((await ensureProfile("u3")).timezone).toBe("Europe/London");
  });
});
