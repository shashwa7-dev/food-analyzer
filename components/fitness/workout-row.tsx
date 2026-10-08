import Link from "next/link";
import { ChevronRight, Dumbbell, Flame } from "lucide-react";
import { IconTile } from "@/components/ui/icon-tile";
import { ACTIVITY_ICONS } from "@/components/fitness/activity-icons";
import type { WorkoutListItem } from "@/lib/fitness/types";
import { cn } from "@/lib/utils";

/** "48 min · 14 sets" for a gym session, "35 min · moderate" for an activity. */
export function workoutMeta(w: Pick<WorkoutListItem, "kind" | "durationMin" | "setCount" | "intensity">): string {
  const detail = w.kind === "gym" ? `${w.setCount} ${w.setCount === 1 ? "set" : "sets"}` : w.intensity;
  return `${w.durationMin} min · ${detail}`;
}

/** "~310" when the burn used the 70 kg estimate. */
export const burnLabel = (w: Pick<WorkoutListItem, "kcalBurned" | "kcalEstimated">) =>
  `${w.kcalEstimated ? "~" : ""}${Math.round(w.kcalBurned).toLocaleString("en-IN")}`;

/**
 * One workout as a 56 px row (mock-c1 `.t2-row`) linking to its summary: the icon tile, the title over
 * "48 min · 14 sets", and the kcal burned. `meta` overrides the muted line (Progress adds the day).
 */
export function WorkoutRow({ w, meta, className }: { w: WorkoutListItem; meta?: string; className?: string }) {
  const Icon = w.kind === "activity" && w.activity ? ACTIVITY_ICONS[w.activity] : Dumbbell;
  return (
    <Link href={`/workouts/${w.id}`} className={cn("flex min-h-14 min-w-0 items-center gap-3 rounded-[14px] text-ink", className)}>
      <IconTile tone="protein"><Icon /></IconTile>
      <span className="min-w-0 flex-1 leading-tight">
        <b className="block truncate text-[14.5px] font-semibold whitespace-nowrap">{w.title}</b>
        <span className="num block truncate text-[12.5px] whitespace-nowrap text-subtle">{meta ?? workoutMeta(w)}</span>
      </span>
      <span className="num inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold whitespace-nowrap text-ink">
        <Flame className="size-3.5 text-subtle" aria-hidden />
        {burnLabel(w)}
        <span className="sr-only"> kcal burned</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-subtle" aria-hidden />
    </Link>
  );
}
