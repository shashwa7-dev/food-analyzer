import { requireUser } from "@/lib/session";
import { getFitnessSummary } from "@/lib/fitness/service";
import { getWeightHistory } from "@/lib/fitness/weight";
import { FitnessView } from "@/components/workouts/fitness-view";

/**
 * Workouts hub (spec §C screen 6, mock-c1 Fitness 0): sessions, the weekly goal and weight. Moved off
 * Progress → Fitness so it's its own nav destination; Task 4 rebuilds this page with trends and history.
 */
export default async function WorkoutsPage() {
  const { userId } = await requireUser();
  const [summary, weight] = await Promise.all([getFitnessSummary(userId), getWeightHistory(userId, { days: 30 })]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 md:gap-6">
      <header className="flex min-h-11 items-center justify-between gap-2.5 md:col-span-2">
        <h1 className="m-0 text-[30px] font-[650] leading-[1.05] tracking-[-0.04em] text-ink md:text-[40px]">Workouts</h1>
      </header>
      <FitnessView summary={summary} weight={weight} />
    </div>
  );
}
