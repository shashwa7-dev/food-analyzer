import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createUser, resetDb, testDb } from "@/tests/helpers/db";
import { waitlist } from "@/lib/db/schema";
import { isOnWaitlist, joinWaitlist } from "./waitlist";

describe("credits/waitlist", () => {
  beforeEach(resetDb);

  it("is false for a user who has not joined", async () => {
    const u = await createUser();
    expect(await isOnWaitlist(u)).toBe(false);
  });

  it("joins the waitlist and is reflected by isOnWaitlist", async () => {
    const u = await createUser();
    await joinWaitlist(u);
    expect(await isOnWaitlist(u)).toBe(true);

    const rows = await testDb().select().from(waitlist).where(eq(waitlist.userId, u));
    expect(rows).toHaveLength(1);
  });

  it("joining twice keeps exactly one row (idempotent)", async () => {
    const u = await createUser();
    await joinWaitlist(u);
    await joinWaitlist(u);

    const rows = await testDb().select().from(waitlist).where(eq(waitlist.userId, u));
    expect(rows).toHaveLength(1);
  });

  it("scopes isOnWaitlist to the given user", async () => {
    const a = await createUser();
    const b = await createUser();
    await joinWaitlist(a);

    expect(await isOnWaitlist(a)).toBe(true);
    expect(await isOnWaitlist(b)).toBe(false);
  });
});
