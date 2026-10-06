import { z } from "zod";
import { requireApiUser } from "@/lib/session";
import { invalid } from "@/lib/http";
import { updateTimezone } from "@/lib/profile/service";

const Body = z.object({ timezone: z.string().min(1).max(64) });

export async function POST(req: Request) {
  const userId = await requireApiUser(req);
  if (userId instanceof Response) return userId;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return invalid();
  await updateTimezone(userId, body.data.timezone);
  return new Response(null, { status: 204 });
}
