import { requireUser } from "@/lib/session";
import { allows } from "@/lib/credits/plans";
import { defaultMealIn } from "@/lib/dates";
import type { Range } from "@/lib/progress/aggregate";
import { getProgress } from "@/lib/progress/service";
import { cn } from "@/lib/utils";
import { Kpis } from "@/components/progress/kpis";
import { RangeToggle } from "@/components/progress/range-toggle";
import { CaloriesCard } from "@/components/progress/calories-card";
import { MacroSplitCard } from "@/components/progress/macro-donut";
import { BalanceCard } from "@/components/progress/balance-card";
import { SodiumCard } from "@/components/progress/sodium-card";
import { GradeDonutCard } from "@/components/progress/grade-donut";
import { WorkoutsCard } from "@/components/progress/workouts-card";
import { ProgressEmpty } from "@/components/progress/empty-state";

/** Fewer logged days than this and the charts would say nothing (spec §6.12). */
const MIN_DAYS_FOR_TRENDS = 2;

/**
 * Progress (spec §6.12, mock "Progress"). The phone reads top to bottom in DOM order; from 900 px
 * the cards sit in two columns in the desktop mock's order (calories, balance + quality, then the rest).
 */
export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { userId, profile } = await requireUser();
  // Month is Pro-only once PRO_GATES_ENFORCED is on: a locked month shows the week with a Pro chip on the toggle.
  const monthLocked = !allows(profile.plan, "progressMonth");
  const range: Range = (await searchParams).range === "month" && !monthLocked ? "month" : "week";
  const summary = await getProgress(userId, range);
  const period = range === "week" ? "This week" : "This month";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 md:gap-6">
      <header className="flex items-center justify-between gap-2.5 md:col-span-2">
        <h1 className="m-0 text-[30px] font-[650] leading-[1.05] tracking-[-0.04em] text-ink md:text-[40px]">
          <span className="md:hidden">Progress</span>
          <span className="hidden md:inline">{period}</span>
        </h1>
        <RangeToggle range={range} monthLocked={monthLocked} />
      </header>

      {summary.kpis.daysLogged < MIN_DAYS_FOR_TRENDS ? (
        <ProgressEmpty meal={defaultMealIn(profile.timezone)} range={range} />
      ) : (
        <>
          <Kpis kpis={summary.kpis} />
          <CaloriesCard summary={summary} goal={profile.goal} className="md:order-1 md:col-span-2" />
          <MacroSplitCard split={summary.macroSplit} avgKcal={summary.kpis.avgKcal} className="md:order-4" />
          <BalanceCard summary={summary} className="md:order-2" />
          <SodiumCard summary={summary} className="md:order-5" />
          {/* Food quality: always on desktop; on phones only under Month (spec §6.12). */}
          <GradeDonutCard mix={summary.gradeMix} className={cn("md:order-3", range === "week" && "hidden md:grid")} />
          <WorkoutsCard className="md:order-6 md:col-span-2" />
        </>
      )}
    </div>
  );
}
