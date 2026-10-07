import { z } from "zod";
import { requireApiUser } from "@/lib/session";
import { invalid, json, serverError } from "@/lib/http";
import { RANGES } from "@/lib/progress/aggregate";
import { getProgress } from "@/lib/progress/service";

const Query = z.object({ range: z.enum(RANGES).default("week") });

/** GET /api/v1/progress?range=week|month → ProgressSummary for the signed-in user. */
export async function GET(req: Request) {
  try {
    const userId = await requireApiUser(req);
    if (userId instanceof Response) return userId;
    const parsed = Query.safeParse({ range: new URL(req.url).searchParams.get("range") ?? undefined });
    if (!parsed.success) return invalid("Pick a range of week or month.");
    return json(await getProgress(userId, parsed.data.range));
  } catch {
    return serverError();
  }
}
