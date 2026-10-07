import { z } from "zod";

// Detects the `{ fromScanId }` request-body shape before validating it, so a present-but-malformed id
// 404s like the service does (an unknown/invalid scan id is NotFound, never a 400 "invalid body")
// instead of falling through to the manual CustomFoodSchema body and failing that validation with a
// generic 400. Kept in its own module (no session/db imports) so it can be unit-tested without the
// env vars lib/session.ts pulls in via lib/auth.ts.
export function extractFromScanId(raw: unknown): { present: boolean; scanId: string | null } {
  if (!raw || typeof raw !== "object" || !("fromScanId" in raw)) return { present: false, scanId: null };
  const parsed = z.uuid().safeParse((raw as Record<string, unknown>).fromScanId);
  return { present: true, scanId: parsed.success ? parsed.data : null };
}
