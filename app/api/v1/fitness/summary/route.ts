import { requireApiUser } from "@/lib/session";
import { invalid, json, serverError } from "@/lib/http";
import { getFitnessSummary, SummaryQuerySchema } from "@/lib/fitness/service";

/** GET /api/v1/fitness/summary?week=YYYY-MM-DD → FitnessSummary for the Monday–Sunday week containing that date (default today). */
export async function GET(req: Request) {
  try {
    const userId = await requireApiUser(req);
    if (userId instanceof Response) return userId;
    const parsed = SummaryQuerySchema.safeParse({ week: new URL(req.url).searchParams.get("week") ?? undefined });
    if (!parsed.success) return invalid("Pick a week as YYYY-MM-DD.");
    return json(await getFitnessSummary(userId, parsed.data));
  } catch {
    return serverError();
  }
}
