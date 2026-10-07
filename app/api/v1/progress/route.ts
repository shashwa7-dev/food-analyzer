import { z } from "zod";
import { requireApiUser } from "@/lib/session";
import { apiError, invalid, json, serverError } from "@/lib/http";
import { allows } from "@/lib/credits/plans";
import { getProfile } from "@/lib/profile/service";
import { RANGES } from "@/lib/progress/aggregate";
import { getProgress } from "@/lib/progress/service";

const Query = z.object({ range: z.enum(RANGES).default("week") });

/** GET /api/v1/progress?range=week|month → ProgressSummary for the signed-in user. Month is Pro-only once PRO_GATES_ENFORCED is on (403 PRO_REQUIRED). */
export async function GET(req: Request) {
  try {
    const userId = await requireApiUser(req);
    if (userId instanceof Response) return userId;
    const parsed = Query.safeParse({ range: new URL(req.url).searchParams.get("range") ?? undefined });
    if (!parsed.success) return invalid("Pick a range of week or month.");
    if (parsed.data.range === "month" && !allows((await getProfile(userId)).plan, "progressMonth")) {
      return apiError(403, "PRO_REQUIRED", "The month view is part of Pro.");
    }
    return json(await getProgress(userId, parsed.data.range));
  } catch {
    return serverError();
  }
}
