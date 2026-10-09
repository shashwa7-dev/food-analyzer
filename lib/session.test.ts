import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const findProfile = vi.fn();
const ensureProfile = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } } }));
vi.mock("@/lib/profile/service", () => ({ findProfile: (...a: unknown[]) => findProfile(...a), ensureProfile: (...a: unknown[]) => ensureProfile(...a) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`REDIRECT ${to}`); } }));

import { requireApiUser } from "./session";

const SESSION = { user: { id: "u1", email: "a@b.c", name: "A" }, session: { id: "s1" } };
const PROFILE = { userId: "u1" };
const req = () => new Request("http://localhost/api/v1/me");
/** Whether a getSession call asked the database directly, skipping the cookie. */
const fromDb = (call: unknown[]) => (call[0] as { query?: { disableCookieCache?: boolean } }).query?.disableCookieCache === true;

beforeEach(() => { getSession.mockReset(); findProfile.mockReset(); ensureProfile.mockReset(); });

describe("requireApiUser", () => {
  it("is a 401 without a session, and never looks for a profile", async () => {
    getSession.mockResolvedValue(null);
    const res = await requireApiUser(req());
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(401);
    expect(findProfile).not.toHaveBeenCalled();
  });

  it("trusts the cookie when the profile exists: one session read, no write", async () => {
    getSession.mockResolvedValue(SESSION);
    findProfile.mockResolvedValue(PROFILE);
    expect(await requireApiUser(req())).toBe("u1");
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(fromDb(getSession.mock.calls[0]!)).toBe(false);
    expect(ensureProfile).not.toHaveBeenCalled();
  });

  it("with no profile, checks the session against the database before creating one (first visit)", async () => {
    getSession.mockResolvedValue(SESSION);
    findProfile.mockResolvedValue(undefined);
    ensureProfile.mockResolvedValue(PROFILE);
    expect(await requireApiUser(req())).toBe("u1");
    expect(getSession).toHaveBeenCalledTimes(2);
    expect(fromDb(getSession.mock.calls[1]!)).toBe(true);
    expect(ensureProfile).toHaveBeenCalledTimes(1);
  });

  it("is a 401, creating nothing, when the cookie vouches for an account that is gone", async () => {
    getSession.mockResolvedValueOnce(SESSION).mockResolvedValueOnce(null);
    findProfile.mockResolvedValue(undefined);
    const res = await requireApiUser(req());
    expect((res as Response).status).toBe(401);
    expect(ensureProfile).not.toHaveBeenCalled();
  });
});
