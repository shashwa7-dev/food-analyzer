import { requireUser } from "@/lib/session";
import { LogWorkout } from "@/components/fitness/log-workout";

/** Log workout (spec §C screen 1): pick a gym preset or an empty session, or log another activity. */
export default async function NewWorkoutPage() {
  const { userId, profile } = await requireUser();
  return <LogWorkout userId={userId} timezone={profile.timezone} />;
}
