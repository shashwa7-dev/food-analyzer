import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUser, resetDb } from "@/tests/helpers/db";
import { getBalance } from "@/lib/credits/ledger";

const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/lib/session", async () => {
  const { unauthorized } = await import("@/lib/http");
  return { requireApiUser: async () => session.userId ?? unauthorized() };
});

const { GET } = await import("./route");
const call = (qs = "") => GET(new Request(`http://localhost/api/v1/credits/activity${qs}`));

describe("GET /api/v1/credits/activity", () => {
  beforeEach(async () => {
    await resetDb();
    session.userId = null;
  });

  it("needs a session", async () => {
    expect((await call()).status).toBe(401);
  });

  it("returns the caller's activity, filtered, and rejects a bad filter or cursor", async () => {
    session.userId = await createUser();
    await getBalance(session.userId);
    const all = await (await call()).json();
    expect(all.items.map((i: { kind: string }) => i.kind)).toEqual(["grant"]);
    expect(all.nextCursor).toBeNull();
    expect((await (await call("?filter=refunds")).json()).items).toEqual([]);
    for (const qs of ["?filter=everything", "?cursor=nope"]) {
      const bad = await call(qs);
      expect(bad.status).toBe(400);
      expect((await bad.json()).error.code).toBe("INVALID_INPUT");
    }
  });
});
