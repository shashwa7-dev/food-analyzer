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
 * Desktop (`md:grid-cols-[minmax(0,1fr)_300px]`), two independent stacks:
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
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 md:grid-cols-[minmax(0,1fr)_300px] md:items-start md:gap-x-5">
      <header className="flex min-h-11 items-center justify-between gap-2.5 md:col-span-2">
        <h1 className="m-0 text-[30px] leading-[1.05] font-[650] tracking-[-0.04em] text-ink md:text-[40px]">Workouts</h1>
        <RangeSwitch range={stats.range} locked={locked} />
      </header>

      {/* Two columns, one DOM. On phones both wrappers are `display: contents`, so their children join the
          page grid and `order-*` interleaves them; from md up each wrapper is its own vertical stack. */}
      <div className="contents md:flex md:min-w-0 md:flex-col md:gap-5">
        <UpNextCard next={summary.upNext} className="order-3 md:order-none" />
        {proSlot != null && <div className="order-4 md:order-none">{proSlot}</div>}
        <HistoryList initial={history} className="order-8 md:order-none" />
      </div>
      <div className="contents md:flex md:min-w-0 md:flex-col md:gap-5">
        <GoalCard goal={summary.week.goal} className="order-1 md:order-none" />
        <WeekDots days={summary.week.days} className="order-2 md:order-none" />
        <StatTiles stats={stats} goalMet={summary.week.goal.met} className="order-5 md:order-none" />
        {proAside != null && <div className="order-6 md:order-none">{proAside}</div>}
        <WeightCard weight={weight} className="order-7 md:order-none" />
      </div>
    </div>
  );
}
