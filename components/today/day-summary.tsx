import { CalorieCard } from "@/components/today/calorie-card";
import { MacroTiles } from "@/components/today/macro-tiles";
import { DailyLimitsCard, hasLimitAlert } from "@/components/today/daily-limits-card";
import type { TargetProgress } from "@/lib/nutrition/totals";

function find(progress: TargetProgress[], key: TargetProgress["key"]): TargetProgress {
  const p = progress.find((x) => x.key === key);
  if (!p) throw new Error(`missing progress for ${key}`);
  return p;
}

const amount = (p: TargetProgress) => ({ eaten: p.total, target: p.target });

/**
 * The day's calorie card and macro tiles, from `dayTotals().progress`. On phones the Daily limits card
 * follows, only when a limit is at 90% or more (calm by default); from 900 px it lives in the insights
 * rail, always shown, so it is not repeated here.
 */
export function DaySummary({ progress }: { progress: TargetProgress[] }) {
  const kcal = find(progress, "energyKcal");
  return (
    <div className="flex flex-col gap-3">
      <CalorieCard eaten={kcal.total} target={kcal.target} />
      <MacroTiles protein={amount(find(progress, "protein"))} carbs={amount(find(progress, "carbs"))} fat={amount(find(progress, "fat"))} />
      {hasLimitAlert(progress) && <DailyLimitsCard progress={progress} className="md:hidden" />}
    </div>
  );
}
