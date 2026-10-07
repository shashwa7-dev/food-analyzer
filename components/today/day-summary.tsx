import { CalorieCard } from "@/components/today/calorie-card";
import { MacroTiles } from "@/components/today/macro-tiles";
import type { TargetProgress } from "@/lib/nutrition/totals";

function find(progress: TargetProgress[], key: TargetProgress["key"]): TargetProgress {
  const p = progress.find((x) => x.key === key);
  if (!p) throw new Error(`missing progress for ${key}`);
  return p;
}

const amount = (p: TargetProgress) => ({ eaten: p.total, target: p.target });

/** The day's calorie card and macro tiles, from `dayTotals().progress`. */
export function DaySummary({ progress }: { progress: TargetProgress[] }) {
  const kcal = find(progress, "energyKcal");
  return (
    <div className="flex flex-col gap-3">
      <CalorieCard eaten={kcal.total} target={kcal.target} />
      <MacroTiles protein={amount(find(progress, "protein"))} carbs={amount(find(progress, "carbs"))} fat={amount(find(progress, "fat"))} />
    </div>
  );
}
