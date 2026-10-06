import { requireApiUser } from "@/lib/session";
import { apiError, invalid, json, notFound } from "@/lib/http";
import { DateSchema, todayIn } from "@/lib/dates";
import { InvalidError, NotFoundError } from "@/lib/errors";
import { addEntry, AddEntrySchema, getDay } from "@/lib/log/service";
import { getProfile } from "@/lib/profile/service";

export async function GET(req: Request) {
  const userId = await requireApiUser(req);
  if (userId instanceof Response) return userId;
  const param = new URL(req.url).searchParams.get("date");
  const date = param ?? todayIn((await getProfile(userId)).timezone);
  if (!DateSchema.safeParse(date).success) return invalid("Pick a date within the last year.");
  return json(await getDay(userId, date));
}

export async function POST(req: Request) {
  const userId = await requireApiUser(req);
  if (userId instanceof Response) return userId;
  const body = AddEntrySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return invalid();
  try {
    return json({ entry: await addEntry(userId, body.data) }, { status: 201 });
  } catch (e) {
    if (e instanceof NotFoundError) return notFound();
    if (e instanceof InvalidError) return invalid(e.message);
    return apiError(500, "SERVER_ERROR", "Something went wrong. Try again.");
  }
}
