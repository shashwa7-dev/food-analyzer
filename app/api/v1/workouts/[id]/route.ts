import { requireApiUser } from "@/lib/session";
import { invalid, json, notFound, serverError } from "@/lib/http";
import { InvalidError } from "@/lib/errors";
import { deleteWorkout, getWorkout, updateWorkout, UpdateWorkoutSchema } from "@/lib/fitness/service";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/v1/workouts/{id} → { workout: WorkoutDetail } with exercises, sets, best sets and PR flags. */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const userId = await requireApiUser(req);
    if (userId instanceof Response) return userId;
    const w = await getWorkout(userId, (await params).id);
    return w ? json({ workout: w }) : notFound();
  } catch {
    return serverError();
  }
}

/** PATCH /api/v1/workouts/{id}: title, duration, intensity, notes and the full exercise list; kcal is recomputed. */
export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await requireApiUser(req);
  if (userId instanceof Response) return userId;
  const body = UpdateWorkoutSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return invalid();
  try {
    const w = await updateWorkout(userId, (await params).id, body.data);
    return w ? json({ workout: w }) : notFound();
  } catch (e) {
    if (e instanceof InvalidError) return invalid(e.message);
    return serverError();
  }
}

/** DELETE /api/v1/workouts/{id} → 204 (soft delete). */
export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const userId = await requireApiUser(req);
    if (userId instanceof Response) return userId;
    return (await deleteWorkout(userId, (await params).id)) ? new Response(null, { status: 204 }) : notFound();
  } catch {
    return serverError();
  }
}
