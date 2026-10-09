import { requireApiUser } from "@/lib/session";
import { invalid, json, serverError } from "@/lib/http";
import { InvalidError } from "@/lib/errors";
import { createWorkout, CreateWorkoutSchema, ListQuerySchema, listWorkouts } from "@/lib/fitness/service";

/** GET /api/v1/workouts?from=&to= → { workouts: WorkoutListItem[] }, newest first (default: the last 30 days). */
export async function GET(req: Request) {
  try {
    const userId = await requireApiUser(req);
    if (userId instanceof Response) return userId;
    const sp = new URL(req.url).searchParams;
    const parsed = ListQuerySchema.safeParse({ from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined });
    if (!parsed.success) return invalid("Use dates as YYYY-MM-DD.");
    return json({ workouts: await listWorkouts(userId, parsed.data) });
  } catch (e) {
    if (e instanceof InvalidError) return invalid(e.message);
    return serverError();
  }
}

/** POST /api/v1/workouts → 201 { workout: WorkoutDetail }. kcal_burned is computed here, never taken from the client. */
export async function POST(req: Request) {
  const userId = await requireApiUser(req);
  if (userId instanceof Response) return userId;
  const body = CreateWorkoutSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return invalid();
  try {
    return json({ workout: await createWorkout(userId, body.data) }, { status: 201 });
  } catch (e) {
    if (e instanceof InvalidError) return invalid(e.message);
    return serverError();
  }
}
