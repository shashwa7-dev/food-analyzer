import { useId } from "react";
import Link from "next/link";
import { Dumbbell, Plus } from "lucide-react";
import { RailCard, RailCardHead } from "@/components/today/rail-card";
import { WorkoutRow } from "@/components/fitness/workout-row";
import type { WorkoutListItem } from "@/lib/fitness/types";

/**
 * Today's workouts (spec §C screen 5, mock-c1 Fitness 5): each a row linking to its summary, and
 * "+ Log" to /workouts/new. Under the macro tiles on phones; in the insights rail from 900 px.
 */
export function WorkoutsCard({ workouts, isToday, className }: { workouts: WorkoutListItem[]; isToday: boolean; className?: string }) {
  const titleId = useId();
  return (
    <RailCard labelledBy={titleId} className={className}>
      <RailCardHead id={titleId} icon={Dumbbell} title="Workouts">
        <Link
          href="/workouts/new"
          className="-my-2 -mr-2 inline-flex min-h-11 shrink-0 items-center gap-[3px] rounded-full px-2 text-[13px] font-semibold whitespace-nowrap text-brand-deep hover:underline hover:underline-offset-4"
        >
          <Plus className="size-[15px]" aria-hidden />
          Log<span className="sr-only"> a workout</span>
        </Link>
      </RailCardHead>
      {workouts.length === 0 ? (
        <p className="m-0 truncate text-[13.5px] text-subtle">{isToday ? "No workouts yet today." : "No workouts this day."}</p>
      ) : (
        <ul className="m-0 grid list-none gap-0.5 p-0">
          {workouts.map((w) => (
            <li key={w.id}>
              <WorkoutRow w={w} />
            </li>
          ))}
        </ul>
      )}
    </RailCard>
  );
}
