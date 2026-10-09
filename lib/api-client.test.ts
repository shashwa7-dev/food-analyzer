import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, DATA_CHANGED_EVENT } from "./api-client";

const json = (status: number, body: unknown) => new Response(status === 204 ? null : JSON.stringify(body), { status });
let changed = 0;

beforeEach(() => {
  changed = 0;
  const target = new EventTarget();
  target.addEventListener(DATA_CHANGED_EVENT, () => { changed += 1; });
  vi.stubGlobal("window", target);
});
afterEach(() => vi.unstubAllGlobals());

describe("api: announcing writes", () => {
  it("says nothing after a read", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { ok: 1 })));
    await api("/api/v1/me");
    await api("/api/v1/me", { method: "GET" });
    expect(changed).toBe(0);
  });
  it("announces a successful write, whatever the method's case, including an empty 204", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { id: "x" })));
    await api("/api/v1/log", { method: "POST", body: "{}" });
    await api("/api/v1/log/1", { method: "patch", body: "{}" });
    vi.stubGlobal("fetch", vi.fn(async () => json(204, null)));
    await api("/api/v1/log/1", { method: "DELETE" });
    expect(changed).toBe(3);
  });
  it("says nothing when the write failed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(422, { error: { code: "INVALID", message: "No." } })));
    await expect(api("/api/v1/log", { method: "POST", body: "{}" })).rejects.toBeInstanceOf(ApiError);
    expect(changed).toBe(0);
  });
  it("still works where there is no window (a server render)", async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { id: "x" })));
    await expect(api("/api/v1/log", { method: "POST", body: "{}" })).resolves.toEqual({ id: "x" });
  });
});
