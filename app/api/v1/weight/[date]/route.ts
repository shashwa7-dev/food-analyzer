import { requireApiUser } from "@/lib/session";
import { notFound, serverError } from "@/lib/http";
import { deleteWeight } from "@/lib/fitness/weight";

type Ctx = { params: Promise<{ date: string }> };

/** DELETE /api/v1/weight/{YYYY-MM-DD} → 204. */
export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const userId = await requireApiUser(req);
    if (userId instanceof Response) return userId;
    return (await deleteWeight(userId, (await params).date)) ? new Response(null, { status: 204 }) : notFound();
  } catch {
    return serverError();
  }
}
