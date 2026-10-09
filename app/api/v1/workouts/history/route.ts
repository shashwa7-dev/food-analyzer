import { requireApiUser } from "@/lib/session";
import { json, serverError } from "@/lib/http";
import { historyPage } from "@/lib/fitness/service";

/** GET /api/v1/workouts/history?cursor= → HistoryPage, 20 workouts at a time, newest first. */
export async function GET(req: Request) {
  try {
    const userId = await requireApiUser(req);
    if (userId instanceof Response) return userId;
    const cursor = new URL(req.url).searchParams.get("cursor");
    return json(await historyPage(userId, cursor));
  } catch {
    return serverError();
  }
}
