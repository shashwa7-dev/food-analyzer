import { z } from "zod";
import { requireApiUser } from "@/lib/session";
import { apiError, invalid, json, notFound, serverError } from "@/lib/http";
import { NotFoundError } from "@/lib/errors";
import { createCustomFood, createCustomFoodFromScan, CustomFoodSchema, searchFoods } from "@/lib/foods/service";
import { getProfile } from "@/lib/profile/service";
import { extractFromScanId } from "./from-scan";

export async function GET(req: Request) {
  try {
    const userId = await requireApiUser(req);
    if (userId instanceof Response) return userId;
    const url = new URL(req.url);
    const q = z.string().trim().min(2).max(60).safeParse(url.searchParams.get("q") ?? "");
    if (!q.success) return invalid("Type at least 2 letters.");
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20));
    const prof = await getProfile(userId);
    return json({ results: await searchFoods(userId, q.data, prof.country, limit) });
  } catch {
    return serverError();
  }
}

export async function POST(req: Request) {
  const userId = await requireApiUser(req);
  if (userId instanceof Response) return userId;
  const raw = await req.json().catch(() => null);

  const fromScan = extractFromScanId(raw);
  if (fromScan.present) {
    if (!fromScan.scanId) return notFound();
    try {
      return json({ food: await createCustomFoodFromScan(userId, fromScan.scanId) }, { status: 201 });
    } catch (e) {
      if (e instanceof NotFoundError) return notFound();
      return apiError(500, "SERVER_ERROR", "Something went wrong. Try again.");
    }
  }

  const body = CustomFoodSchema.safeParse(raw);
  if (!body.success) return invalid();
  try {
    return json({ food: await createCustomFood(userId, body.data) }, { status: 201 });
  } catch {
    return apiError(500, "SERVER_ERROR", "Something went wrong. Try again.");
  }
}
