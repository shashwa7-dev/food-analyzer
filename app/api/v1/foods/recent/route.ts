import { requireApiUser } from "@/lib/session";
import { json, serverError } from "@/lib/http";
import { recentFoods } from "@/lib/foods/service";

export async function GET(req: Request) {
  try {
    const userId = await requireApiUser(req);
    if (userId instanceof Response) return userId;
    return json({ results: await recentFoods(userId) });
  } catch {
    return serverError();
  }
}
