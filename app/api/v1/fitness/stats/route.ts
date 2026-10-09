import { requireApiUser } from "@/lib/session";
import { apiError, invalid, json, serverError } from "@/lib/http";
import { ProRequiredError } from "@/lib/errors";
import { getFitnessStats, StatsQuerySchema } from "@/lib/fitness/service";

/** GET /api/v1/fitness/stats?range=week|month → FitnessStats. Month is Pro-only once PRO_GATES_ENFORCED is on. */
export async function GET(req: Request) {
  try {
    const userId = await requireApiUser(req);
    if (userId instanceof Response) return userId;
    const parsed = StatsQuerySchema.safeParse({ range: new URL(req.url).searchParams.get("range") ?? undefined });
    if (!parsed.success) return invalid("Pick week or month.");
    return json(await getFitnessStats(userId, parsed.data.range));
  } catch (err) {
    if (err instanceof ProRequiredError) return apiError(403, "PRO_REQUIRED", "Month stats are part of Pro.");
    return serverError();
  }
}
