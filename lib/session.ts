import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ensureProfile } from "@/lib/profile/service";
import { countryFrom, unauthorized } from "@/lib/http";

/**
 * The signed-in user and their profile, or a redirect to /sign-in. Cached for the request, so the
 * app layout and the page it wraps share one lookup instead of each doing their own.
 */
export const requireUser = cache(async () => {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session) redirect("/sign-in");
  const prof = await ensureProfile(session.user.id, countryFrom(h));
  return { userId: session.user.id, email: session.user.email, name: session.user.name, profile: prof };
});

export async function requireApiUser(req: Request): Promise<string | Response> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return unauthorized();
  await ensureProfile(session.user.id, countryFrom(req.headers));
  return session.user.id;
}
