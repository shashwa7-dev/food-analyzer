import { requireApiUser } from "@/lib/session";
import { invalid, json, serverError } from "@/lib/http";
import { completeFitnessSetup, FitnessSetupSchema } from "@/lib/fitness/service";

/**
 * POST /api/v1/me/fitness/setup { skip: true } | { heightCm?, weightKg?, goalWeightKg?, weeklyWorkoutGoal }
 * → { fitness: FitnessSettings }. The Workouts hub's first-visit setup (spec "First-visit setup").
 */
export async function POST(req: Request) {
  const userId = await requireApiUser(req);
  if (userId instanceof Response) return userId;
  const body = FitnessSetupSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return invalid("Height is 100–250 cm, weights 20–400 kg and the goal 1–7 days.");
  try {
    return json({ fitness: await completeFitnessSetup(userId, body.data) });
  } catch {
    return serverError();
  }
}
