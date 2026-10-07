import { requireApiUser } from "@/lib/session";
import { json, notFound, serverError } from "@/lib/http";
import { deleteScan, getScan } from "@/lib/scans/service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const userId = await requireApiUser(req);
    if (userId instanceof Response) return userId;
    const view = await getScan(userId, (await params).id);
    return view ? json(view) : notFound();
  } catch {
    return serverError();
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const userId = await requireApiUser(req);
    if (userId instanceof Response) return userId;
    return (await deleteScan(userId, (await params).id)) ? new Response(null, { status: 204 }) : notFound();
  } catch {
    return serverError();
  }
}
