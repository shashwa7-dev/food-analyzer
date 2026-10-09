import { requireApiUser } from "@/lib/session";
import { invalid, json, serverError } from "@/lib/http";
import { FitnessSettingsSchema, updateFitnessSettings } from "@/lib/fitness/service";

/** PATCH /api/v1/me/fitness { weeklyWorkoutGoal?: 1–7, goalWeightKg?: 20–400 | null, heightCm?: 100–250 | null } → { fitness: FitnessSettings }. */
export async function PATCH(req: Request) {
  try {
    const userId = await requireApiUser(req);
    if (userId instanceof Response) return userId;
    const body = FitnessSettingsSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return invalid("Pick a weekly goal of 1 to 7 days, a goal weight between 20 and 400 kg and a height between 100 and 250 cm.");
    return json({ fitness: await updateFitnessSettings(userId, body.data) });
  } catch {
    return serverError();
  }
}
