import { requireApiUser } from "@/lib/session";
import { apiError, invalid, json, notFound } from "@/lib/http";
import { InvalidError } from "@/lib/errors";
import { deleteEntry, UpdateEntrySchema, updateEntry } from "@/lib/log/service";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await requireApiUser(req);
  if (userId instanceof Response) return userId;
  const body = UpdateEntrySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return invalid();
  try {
    const row = await updateEntry(userId, (await params).id, body.data);
    return row ? json({ entry: row }) : notFound();
  } catch (e) {
    if (e instanceof InvalidError) return invalid(e.message);
    return apiError(500, "SERVER_ERROR", "Something went wrong. Try again.");
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const userId = await requireApiUser(req);
  if (userId instanceof Response) return userId;
  return (await deleteEntry(userId, (await params).id)) ? new Response(null, { status: 204 }) : notFound();
}
