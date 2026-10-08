import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { IconTile } from "@/components/ui/icon-tile";
import type { FitnessSummary } from "@/lib/fitness/types";
import { cn } from "@/lib/utils";

const CARD = "rounded-[24px] bg-surface shadow-card";

/** "2h 50m", "45m", "0m". */
export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

/**
 * The dark weekly goal card (mock-c1 `.fo-goal`, workouts-layout.html ② and workouts-full-v3.html):
 * "{done} of {target}" workout days, with one dot per target day. Dark in both themes (the media tokens
 * don't switch), so the lime dots keep their contrast. `sub` overrides the muted line (EmptyHub's
 * "Your first session starts the streak"). Kept `aria-label="Weekly goal"` (checked by the ui-audit).
 */
export function GoalCard({ goal, sub, className }: { goal: FitnessSummary["week"]["goal"]; sub?: string; className?: string }) {
  const left = Math.max(0, goal.target - goal.done);
  return (
    <section aria-label="Weekly goal" className={cn("flex items-center justify-between gap-3 rounded-[24px] bg-viewfinder p-[18px] text-on-media shadow-card", className)}>
      <div className="min-w-0">
        <span className="block text-[12px] font-semibold tracking-[0.06em] whitespace-nowrap uppercase opacity-70">Weekly goal</span>
        <b className="num mt-1.5 block text-[34px] leading-none font-[650] tracking-[-0.04em] whitespace-nowrap">
          {goal.done} of {goal.target}
        </b>
        <span className="mt-1 block truncate text-[13px] whitespace-nowrap opacity-70">
          workout days · {sub ?? (goal.met ? "goal met" : `${left} to go`)}
        </span>
      </div>
      <div aria-hidden className="grid shrink-0 grid-cols-[repeat(4,18px)] gap-1.5">
        {Array.from({ length: goal.target }, (_, i) => (
          <i key={i} className={cn("block size-[18px] rounded-full border-[1.5px] border-brand", i < goal.done && "bg-brand")} />
        ))}
      </div>
    </section>
  );
}

/**
 * Up next (mock-c1 `.fo-next`, workouts-full-v3.html): the next preset in the rotation, with "Other
 * activity" (ghost) beside "Start" (lime).
 */
export function UpNextCard({ next, className }: { next: FitnessSummary["upNext"]; className?: string }) {
  return (
    <section aria-labelledby="fo-next" className={cn(CARD, "flex min-w-0 flex-wrap items-center gap-3 px-3.5 py-3", className)}>
      <h2 id="fo-next" className="sr-only">Up next</h2>
      <IconTile tone="brand" size="md"><Dumbbell /></IconTile>
      <span className="min-w-0 flex-1 leading-tight">
        <b className="block truncate text-[15px] font-semibold whitespace-nowrap">Up next · {next.title}</b>
        <span className="block truncate text-[13px] whitespace-nowrap text-subtle">{next.muscles} · {next.exerciseCount} exercises</span>
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <Link href="/workouts/new" className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-sunken px-4 text-[13.5px] font-semibold whitespace-nowrap text-ink hover:bg-line">
          Other activity
        </Link>
        <Link href={`/workouts/session?preset=${next.preset}`} className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-action px-4 text-[13.5px] font-semibold whitespace-nowrap text-action-ink">
          Start
        </Link>
      </div>
    </section>
  );
}
