import { requireApiUser } from "@/lib/session";
import { invalid, json, serverError } from "@/lib/http";
import { InvalidError } from "@/lib/errors";
import { loggedDates } from "@/lib/log/service";

/** GET /api/v1/log/dates?month=YYYY-MM → { dates } — the days in that month with food logged. */
export async function GET(req: Request) {
  try {
    const userId = await requireApiUser(req);
    if (userId instanceof Response) return userId;
    const month = new URL(req.url).searchParams.get("month") ?? "";
    return json({ dates: await loggedDates(userId, month) });
  } catch (e) {
    if (e instanceof InvalidError) return invalid(e.message);
    return serverError();
  }
}
