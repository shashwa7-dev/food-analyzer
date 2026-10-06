import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ensureProfile } from "@/lib/profile/service";
import { unauthorized } from "@/lib/http";

export async function requireUser() {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session) redirect("/sign-in");
  const country = h.get("x-vercel-ip-country") ?? undefined;
  const prof = await ensureProfile(session.user.id, country);
  return { userId: session.user.id, email: session.user.email, name: session.user.name, profile: prof };
}

export async function requireApiUser(req: Request): Promise<string | Response> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return unauthorized();
  await ensureProfile(session.user.id, req.headers.get("x-vercel-ip-country") ?? undefined);
  return session.user.id;
}
