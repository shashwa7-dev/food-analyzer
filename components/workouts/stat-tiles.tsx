import { SHORT_MONTHS } from "@/lib/dates";
import type { FitnessStats } from "@/lib/fitness/insights";
import { fmtDuration } from "@/components/workouts/fitness-view";
import { cn } from "@/lib/utils";

const CARD = "rounded-[24px] bg-surface shadow-card";

/** "12.4 t" at or above 1000 kg, else "412 kg". */
function fmtVolume(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)} t` : `${Math.round(kg).toLocaleString("en-IN")} kg`;
}

/** "+3", "−3", "+0": always a sign, en dash for negative (matching fmtChange in weight-view.ts). */
function signed(n: number, fmt: (x: number) => string): string {
  return `${n < 0 ? "−" : "+"}${fmt(Math.abs(n))}`;
}

function Tile({ label, value, sub, positive }: { label: string; value: string; sub: string; positive: boolean }) {
  return (
    <section aria-label={label} className={cn(CARD, "grid min-w-0 gap-0.5 p-3.5")}>
      <span className="text-[12px] font-semibold tracking-[0.06em] whitespace-nowrap text-subtle uppercase">{label}</span>
      <b className="num truncate text-[22px] leading-tight font-[650] tracking-[-0.03em] whitespace-nowrap text-ink">{value}</b>
      <span className={cn("truncate text-[12px] whitespace-nowrap", positive ? "font-semibold text-brand-deep" : "text-subtle")}>{sub}</span>
    </section>
  );
}

/**
 * The 2 × 3 stat grid (workouts-full-v3.html, right column): workout days, total time, calories burned,
 * volume, new PRs and the goal streak, each against the previous period. `goalMet` (this week's goal
 * already hit) picks the streak tile's sub-line between "goal hit" and "in a row".
 */
export function StatTiles({ stats, goalMet, className }: { stats: FitnessStats; goalMet: boolean; className?: string }) {
  const { tiles, goalStreak, range, period } = stats;
  const vs = range === "week" ? "vs last wk" : `vs ${SHORT_MONTHS[Number(period.prevStart.slice(5, 7)) - 1]}`;
  const sub = (delta: number, fmt: (x: number) => string) => `${signed(delta, fmt)} ${vs}`;
  const count = (n: number) => String(n);
  const kcal = (n: number) => Math.round(n).toLocaleString("en-IN");

  return (
    <div className={cn("grid grid-cols-2 gap-3 md:gap-3.5", className)}>
      <Tile label="Workout days" value={count(tiles.workoutDays.value)} sub={sub(tiles.workoutDays.delta, count)} positive={tiles.workoutDays.delta > 0} />
      <Tile label="Total time" value={fmtDuration(tiles.minutes.value)} sub={sub(tiles.minutes.delta, fmtDuration)} positive={tiles.minutes.delta > 0} />
      <Tile
        label="Burned"
        value={`${tiles.kcalEstimated ? "~" : ""}${Math.round(tiles.kcal.value).toLocaleString("en-IN")}`}
        sub={sub(tiles.kcal.delta, kcal)}
        positive={tiles.kcal.delta > 0}
      />
      <Tile label="Volume" value={fmtVolume(tiles.volumeKg.value)} sub={sub(tiles.volumeKg.delta, fmtVolume)} positive={tiles.volumeKg.delta > 0} />
      <Tile label="New PRs" value={count(tiles.prs.value)} sub={sub(tiles.prs.delta, count)} positive={tiles.prs.delta > 0} />
      <Tile label="Goal streak" value={`${goalStreak} ${goalStreak === 1 ? "wk" : "wks"}`} sub={goalMet ? "goal hit" : "in a row"} positive={goalMet} />
    </div>
  );
}
