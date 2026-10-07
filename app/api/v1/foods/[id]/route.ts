import { requireApiUser } from "@/lib/session";
import { invalid, invalidField, json, notFound, serverError } from "@/lib/http";
import { customFoodFieldError, CustomFoodSchema, deleteCustomFood, foodDetail, updateCustomFood } from "@/lib/foods/service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const userId = await requireApiUser(req);
    if (userId instanceof Response) return userId;
    const detail = await foodDetail(userId, (await params).id);
    return detail ? json(detail) : notFound();
  } catch {
    return serverError();
  }
}
export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await requireApiUser(req);
  if (userId instanceof Response) return userId;
  const body = CustomFoodSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    const fe = customFoodFieldError(body.error);
    return fe ? invalidField(fe.field, fe.message) : invalid();
  }
  const row = await updateCustomFood(userId, (await params).id, body.data);
  return row ? json({ food: row }) : notFound();
}
export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const userId = await requireApiUser(req);
    if (userId instanceof Response) return userId;
    return (await deleteCustomFood(userId, (await params).id)) ? new Response(null, { status: 204 }) : notFound();
  } catch {
    return serverError();
  }
}
