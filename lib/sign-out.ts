import { authClient } from "@/lib/auth-client";

/**
 * Signs out, then leaves with a full page load, which drops everything the browser tab was holding
 * for the signed-in user (cached pages, cached queries). Returns false, and stays put, when the
 * server did not end the session: the auth client reports a refusal as `error` instead of throwing,
 * and carrying on regardless would just bounce a still-signed-in user back into the app.
 */
export async function signOutAndLeave(to: string): Promise<boolean> {
  const res = await authClient.signOut().catch(() => null);
  if (!res || res.error) return false;
  window.location.assign(to);
  return true;
}
