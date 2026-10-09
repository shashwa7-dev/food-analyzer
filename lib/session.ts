import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ensureProfile, findProfile } from "@/lib/profile/service";
import { countryFrom, unauthorized } from "@/lib/http";

/**
 * The session and profile behind a request, or null when signed out. The session is normally taken
 * from its five-minute cookie (lib/auth.ts) without asking the database. A missing profile is the
 * one sign that cookie may be vouching for an account that is gone (deleted on another device), so
 * only then is the session checked against the database, before a profile is ever created: a first
 * visit passes that check, a deleted account is signed out instead of failing.
 */
async function signedIn(h: Headers) {
  const cached = await auth.api.getSession({ headers: h });
  if (!cached) return null;
  const existing = await findProfile(cached.user.id);
  if (existing) return { user: cached.user, profile: existing };
  const fresh = await auth.api.getSession({ headers: h, query: { disableCookieCache: true } });
  if (!fresh) return null;
  return { user: fresh.user, profile: await ensureProfile(fresh.user.id, countryFrom(h)) };
}

/**
 * The signed-in user and their profile, or a redirect to /sign-in. Cached for the request, so the
 * app layout and the page it wraps share one lookup instead of each doing their own.
 */
export const requireUser = cache(async () => {
  const who = await signedIn(await headers());
  if (!who) redirect("/sign-in");
  return { userId: who.user.id, email: who.user.email, name: who.user.name, profile: who.profile };
});

export async function requireApiUser(req: Request): Promise<string | Response> {
  const who = await signedIn(req.headers);
  return who ? who.user.id : unauthorized();
}
