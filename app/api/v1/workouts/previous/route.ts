import { z } from "zod";
import { requireApiUser } from "@/lib/session";
import { invalid, json, serverError } from "@/lib/http";
import { previousSetsFor } from "@/lib/fitness/service";

const Keys = z.array(z.string().trim().min(1).max(80)).min(1).max(30);

/** GET /api/v1/workouts/previous?keys=bench_press,squat → { previous: PreviousSets } (keys never done are absent). */
export async function GET(req: Request) {
  try {
    const userId = await requireApiUser(req);
    if (userId instanceof Response) return userId;
    const parsed = Keys.safeParse((new URL(req.url).searchParams.get("keys") ?? "").split(",").filter(Boolean));
    if (!parsed.success) return invalid("Name one to 30 exercise keys.");
    return json({ previous: await previousSetsFor(userId, parsed.data) });
  } catch {
    return serverError();
  }
}
