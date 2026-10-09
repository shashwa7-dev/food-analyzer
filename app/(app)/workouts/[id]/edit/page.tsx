import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getWorkout } from "@/lib/fitness/service";
import { draftFromWorkout } from "@/lib/fitness/draft";
import { EditSession } from "@/components/fitness/session/edit-session";

export const metadata = { title: "Edit workout" };

/**
 * Edit a saved gym session in the live session's editor (no timer; a minutes field; Save). Activity
 * workouts are edited in a sheet on their summary, so they go back there.
 */
export default async function EditWorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await requireUser();
  const id = (await params).id;
  const w = await getWorkout(userId, id);
  if (!w) notFound();
  if (w.kind !== "gym") redirect(`/workouts/${w.id}`);
  return <EditSession workoutId={w.id} initial={draftFromWorkout(w)} durationMin={w.durationMin} />;
}
