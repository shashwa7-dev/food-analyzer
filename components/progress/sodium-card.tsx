import { Droplets } from "lucide-react";
import type { ProgressSummary } from "@/lib/progress/aggregate";
import { sodiumPoints } from "@/lib/progress/chart-data";
import { grouped } from "@/lib/progress/copy";
import { ChartCard, RefKey } from "./chart-card";
import { SodiumLine } from "./charts";

/** Sodium per day against the limit (spec §6.12). */
export function SodiumCard({ summary, className }: { summary: ProgressSummary; className?: string }) {
  const limit = summary.targets.sodiumMgMax;
  const points = sodiumPoints(summary.days, limit);
  const over = points.filter((p) => p.over).length;
  const max = points.find((p) => p.isMax)?.sodium ?? 0;
  const label = `Sodium per day against a ${grouped(limit)} mg limit: ${over} days over, highest ${grouped(max)} mg.`;
  return (
    <ChartCard icon={Droplets} title="Sodium" aside={
        <span className="whitespace-nowrap text-xs text-ink" aria-hidden>
          <RefKey color="var(--bad)">Limit <span className="num">{grouped(limit)}</span> mg</RefKey>
        </span>
      } className={className}>
      <div role="img" aria-label={label}>
        <SodiumLine points={points} limit={limit} />
      </div>
    </ChartCard>
  );
}
