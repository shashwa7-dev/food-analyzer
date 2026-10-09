import { beforeEach, describe, expect, it, vi } from "vitest";

const signOut = vi.fn();
vi.mock("@/lib/auth-client", () => ({ authClient: { signOut: (...a: unknown[]) => signOut(...a) } }));
import { signOutAndLeave } from "./sign-out";

const assign = vi.fn();
beforeEach(() => { signOut.mockReset(); assign.mockReset(); vi.stubGlobal("window", { location: { assign } }); });

describe("signOutAndLeave", () => {
  it("leaves with a full page load once the server has ended the session", async () => {
    signOut.mockResolvedValue({ data: { success: true }, error: null });
    expect(await signOutAndLeave("/")).toBe(true);
    expect(assign).toHaveBeenCalledWith("/");
  });
  it("stays put when the server refused (for example an origin it does not trust)", async () => {
    signOut.mockResolvedValue({ data: null, error: { status: 403, code: "INVALID_ORIGIN", message: "Invalid origin" } });
    expect(await signOutAndLeave("/")).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });
  it("stays put when the request never got through", async () => {
    signOut.mockRejectedValue(new Error("network"));
    expect(await signOutAndLeave("/")).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });
});
