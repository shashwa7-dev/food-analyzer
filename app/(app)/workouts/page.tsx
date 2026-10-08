import { requireUser } from "@/lib/session";
import { allows } from "@/lib/credits/plans";
import { getFitnessStats, getFitnessSummary, historyPage } from "@/lib/fitness/service";
import { getWeightHistory } from "@/lib/fitness/weight";
import { SetupForm } from "@/components/workouts/setup-form";
import { EmptyHub } from "@/components/workouts/empty-hub";
import { Hub } from "@/components/workouts/hub";

/**
 * Workouts hub (spec §C "The /workouts page"): first-visit setup, then the empty state until there's a
 * first workout, then the full hub (goal, up next, week dots, stat tiles, weight and history). `range`
 * (Week | Month) is Pro-gated server-side too: a locked request for Month quietly falls back to Week.
 */
export default async function WorkoutsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { userId, profile } = await requireUser();
  if (!profile.fitnessOnboardedAt) {
    return <SetupForm defaults={{ weeklyWorkoutGoal: profile.weeklyWorkoutGoal, goalWeightKg: profile.goalWeightKg, heightCm: profile.heightCm }} />;
  }
  const locked = !allows(profile.plan, "fitnessInsights");
  const asked = (await searchParams).range === "month" ? "month" : "week";
  const range = asked === "month" && locked ? "week" : asked;
  const [stats, summary, weight, history] = await Promise.all([
    getFitnessStats(userId, range), getFitnessSummary(userId), getWeightHistory(userId, { days: 30 }), historyPage(userId, null),
  ]);
  if (!stats.hasWorkouts) return <EmptyHub summary={summary} weight={weight} />;
  return <Hub stats={stats} summary={summary} weight={weight} history={history} locked={locked} proSlot={null} proAside={null} />;
}
