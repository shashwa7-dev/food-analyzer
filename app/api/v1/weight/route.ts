import { requireApiUser } from "@/lib/session";
import { invalid, json, serverError } from "@/lib/http";
import { getWeightHistory, logWeight, LogWeightSchema, WeightQuerySchema } from "@/lib/fitness/weight";

/** GET /api/v1/weight?days=90 → WeightHistory. */
export async function GET(req: Request) {
  try {
    const userId = await requireApiUser(req);
    if (userId instanceof Response) return userId;
    const parsed = WeightQuerySchema.safeParse({ days: new URL(req.url).searchParams.get("days") ?? undefined });
    if (!parsed.success) return invalid("Pick between 7 and 366 days.");
    return json(await getWeightHistory(userId, parsed.data));
  } catch {
    return serverError();
  }
}

/** POST /api/v1/weight { date, kg } → 201 { entry: WeightEntry }; a second log on the same date replaces the first. */
export async function POST(req: Request) {
  try {
    const userId = await requireApiUser(req);
    if (userId instanceof Response) return userId;
    const body = LogWeightSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return invalid("Enter a weight between 20 and 400 kg for a date within the last year.");
    return json({ entry: await logWeight(userId, body.data) }, { status: 201 });
  } catch {
    return serverError();
  }
}
