import { CircleCheck, Target, TriangleAlert } from "lucide-react";
import type { ProgressSummary } from "@/lib/progress/aggregate";
import { balanceRows } from "@/lib/progress/chart-data";
import { AXIS_LABEL, balanceTakeaway } from "@/lib/progress/copy";
import { CardNote, ChartCard, Takeaway } from "./chart-card";
import { BalanceRadar } from "./charts";

/** Nutrient balance radar and its takeaway line (spec §6.12). */
export function BalanceCard({ summary, className }: { summary: ProgressSummary; className?: string }) {
  const rows = balanceRows(summary.balance);
  const label = `Nutrient balance against targets: ${rows.map((r) => `${AXIS_LABEL[r.key]} ${r.value}%`).join(", ")}.`;
  return (
    <ChartCard icon={Target} title="Nutrient balance" aside={<CardNote>% of target</CardNote>} className={className}>
      <div role="img" aria-label={label} className="grid place-items-center">
        <BalanceRadar balance={summary.balance} />
      </div>
      <Takeaway icon={summary.worstOverLimit ? TriangleAlert : CircleCheck} tone={summary.worstOverLimit ? "warn" : "good"}>
        {balanceTakeaway(summary)}
      </Takeaway>
    </ChartCard>
  );
}
