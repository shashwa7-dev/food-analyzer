import { CircleCheck, Info, Target, TriangleAlert } from "lucide-react";
import type { ProgressSummary } from "@/lib/progress/aggregate";
import { balanceRows } from "@/lib/progress/chart-data";
import { AXIS_LABEL, balanceTakeaway } from "@/lib/progress/copy";
import { CardNote, ChartCard, Takeaway } from "./chart-card";
import { BalanceRadar } from "./charts";

/** Nutrient balance radar and its takeaway line (spec §6.12). */
export function BalanceCard({ summary, className }: { summary: ProgressSummary; className?: string }) {
  const rows = balanceRows(summary.balance);
  // Over on the known values warns; an incomplete limit is muted, never the "good" check.
  const [icon, tone] = summary.worstOverLimit ? [TriangleAlert, "warn" as const] : summary.incomplete.length ? [Info, "muted" as const] : [CircleCheck, "good" as const];
  const label = `Nutrient balance against targets: ${rows.map((r) => `${AXIS_LABEL[r.key]} ${r.value}%`).join(", ")}.`;
  return (
    <ChartCard icon={Target} title="Nutrient balance" aside={<CardNote>% of target</CardNote>} className={className}>
      <div role="img" aria-label={label} className="grid place-items-center">
        <BalanceRadar balance={summary.balance} />
      </div>
      <Takeaway icon={icon} tone={tone}>
        {balanceTakeaway(summary)}
      </Takeaway>
    </ChartCard>
  );
}
