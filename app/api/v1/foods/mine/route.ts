import { requireApiUser } from "@/lib/session";
import { json } from "@/lib/http";
import { myFoods } from "@/lib/foods/service";

export async function GET(req: Request) {
  const userId = await requireApiUser(req);
  if (userId instanceof Response) return userId;
  return json({ results: await myFoods(userId) });
}
