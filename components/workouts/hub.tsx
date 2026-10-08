import type { ReactNode } from "react";
import type { FitnessStats } from "@/lib/fitness/insights";
import type { FitnessSummary, HistoryPage, WeightHistory } from "@/lib/fitness/types";
import { GoalCard, UpNextCard } from "@/components/workouts/fitness-view";
import { WeightCard } from "@/components/workouts/weight-card";
import { RangeSwitch } from "@/components/workouts/range-switch";
import { WeekDots } from "@/components/workouts/week-dots";
import { StatTiles } from "@/components/workouts/stat-tiles";
import { HistoryList } from "@/components/workouts/history-list";

/**
 * The full Workouts hub (workouts-full-v3.html, spec "The /workouts page"): one DOM, reordered by
 * breakpoint with `order-*`/`md:col-start-*` rather than duplicated markup.
 *
 * Phone (single column): goal, this week, up next, proSlot, tiles, proAside, weight, history.
 * Desktop (`md:grid-cols-[minmax(0,1fr)_300px]`):
 *   left  — up next, proSlot, history;
 *   right — goal, this week, tiles, proAside, weight.
 *
 * `proSlot` and `proAside` are Task 5's Trends/Top-exercises and How-often cards; `null` here renders
 * nothing (no empty grid cell left behind).
 */
export function Hub({ stats, summary, weight, history, locked, proSlot, proAside }: {
  stats: FitnessStats; summary: FitnessSummary; weight: WeightHistory; history: HistoryPage;
  locked: boolean; proSlot: ReactNode; proAside: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 md:grid-cols-[minmax(0,1fr)_300px] md:gap-5">
      <header className="flex min-h-11 items-center justify-between gap-2.5 md:col-span-2">
        <h1 className="m-0 text-[30px] leading-[1.05] font-[650] tracking-[-0.04em] text-ink md:text-[40px]">Workouts</h1>
        <RangeSwitch range={stats.range} locked={locked} />
      </header>

      <GoalCard goal={summary.week.goal} className="order-1 md:order-1 md:col-start-2" />
      <WeekDots days={summary.week.days} className="order-2 md:order-2 md:col-start-2" />
      <UpNextCard next={summary.upNext} className="order-3 md:order-1 md:col-start-1" />
      {proSlot != null && <div className="order-4 md:order-2 md:col-start-1">{proSlot}</div>}
      <StatTiles stats={stats} goalMet={summary.week.goal.met} className="order-5 md:order-3 md:col-start-2" />
      {proAside != null && <div className="order-6 md:order-4 md:col-start-2">{proAside}</div>}
      <WeightCard weight={weight} className="order-7 md:order-5 md:col-start-2" />
      <HistoryList initial={history} className="order-8 md:order-3 md:col-start-1" />
    </div>
  );
}
