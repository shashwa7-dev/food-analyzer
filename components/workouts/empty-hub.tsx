import Link from "next/link";
import { ChevronRight, Dumbbell, Footprints } from "lucide-react";
import { IconTile } from "@/components/ui/icon-tile";
import { GoalCard } from "@/components/workouts/fitness-view";
import { WeightCard } from "@/components/workouts/weight-card";
import { PRESETS } from "@/lib/fitness/catalogue";
import { PRESET_KEYS } from "@/lib/fitness/types";
import type { FitnessSummary, WeightHistory } from "@/lib/fitness/types";
import { cn } from "@/lib/utils";

const CARD = "rounded-[24px] bg-surface shadow-card";

/** The six preset tiles (workouts-layout.html ②): the five gym presets plus a free-form "Empty" session. */
const START_TILES = [...PRESET_KEYS.map((key) => ({ key, title: PRESETS[key].title })), { key: "empty", title: "Empty" }];

/**
 * Set up, no workouts yet (workouts-layout.html ②, spec "The /workouts page"): the weekly goal at 0,
 * the preset tiles to start a first session, the "Other activity" row and the weight card. No history,
 * tiles or charts — those only show once there's at least one workout.
 */
export function EmptyHub({ summary, weight }: { summary: FitnessSummary; weight: WeightHistory }) {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3.5 md:gap-5">
      <h1 className="m-0 text-[30px] leading-[1.05] font-[650] tracking-[-0.04em] text-ink md:text-[40px]">Workouts</h1>
      <GoalCard goal={summary.week.goal} sub="Your first session starts the streak" />

      <div className="grid gap-2">
        <span className="px-1 text-[12px] font-semibold tracking-[0.06em] text-subtle uppercase">Start a session</span>
        <div className="grid grid-cols-2 gap-2">
          {START_TILES.map((p) => (
            <Link key={p.key} href={`/workouts/session?preset=${p.key}`} className={cn(CARD, "flex min-h-14 items-center gap-2.5 px-3.5 py-2.5 text-ink")}>
              <IconTile tone="brand"><Dumbbell /></IconTile>
              <b className="truncate text-[14px] font-semibold whitespace-nowrap">{p.title}</b>
            </Link>
          ))}
        </div>
      </div>

      <Link href="/workouts/new" className={cn(CARD, "flex min-h-14 items-center gap-3 px-3.5 py-3 text-ink")}>
        <IconTile tone="brand"><Footprints /></IconTile>
        <span className="min-w-0 flex-1 leading-tight">
          <b className="block truncate text-[14.5px] font-semibold whitespace-nowrap">Other activity</b>
          <span className="block truncate text-[12.5px] whitespace-nowrap text-subtle">Walk, run, cycling, yoga, sport</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-subtle" aria-hidden />
      </Link>

      <WeightCard weight={weight} />
    </div>
  );
}
