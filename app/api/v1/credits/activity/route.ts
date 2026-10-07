import { z } from "zod";
import { requireApiUser } from "@/lib/session";
import { invalid, json, serverError } from "@/lib/http";
import { InvalidError } from "@/lib/errors";
import { ACTIVITY_FILTERS } from "@/lib/credits/activity";
import { listActivity } from "@/lib/credits/ledger";

const Query = z.object({
  filter: z.enum(ACTIVITY_FILTERS).default("all"),
  cursor: z.string().max(120).optional(),
});

/** GET /api/v1/credits/activity?filter=all|used|free|refunds&cursor= → { items, nextCursor } for the signed-in user. */
export async function GET(req: Request) {
  try {
    const userId = await requireApiUser(req);
    if (userId instanceof Response) return userId;
    const sp = new URL(req.url).searchParams;
    const q = Query.safeParse({ filter: sp.get("filter") || undefined, cursor: sp.get("cursor") || undefined });
    if (!q.success) return invalid();
    return json(await listActivity(userId, q.data.filter, q.data.cursor));
  } catch (e) {
    if (e instanceof InvalidError) return invalid();
    console.error("GET /api/v1/credits/activity failed", e);
    return serverError();
  }
}
