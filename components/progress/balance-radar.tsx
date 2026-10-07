"use client";

import { EvilRadarChart } from "@/components/charts/recharts-radar-chart";
import { BALANCE_CAP, type ProgressSummary } from "@/lib/progress/aggregate";
import { balanceRows } from "@/lib/progress/chart-data";
import { AXIS_LABEL } from "@/lib/progress/copy";
import { AXIS_TICK, series, token } from "./chart-theme";

const R = 84; // fixed outer radius (px) inside the 240 px square so the grid rings can sit at exact percentages
const ring = (pct: number) => (pct / BALANCE_CAP) * R;
const config = { value: series("% of target", token("brand-deep")) };

type DotProps = { cx?: number; cy?: number; index?: number };

/**
 * Six-axis balance (spec §6.12): % of target for protein, fibre and calories, % of limit for sugar,
 * sodium and sat fat, capped at 150. The dashed ring is 100%; a limit over it gets a red point.
 */
export default function BalanceRadar({ balance }: { balance: ProgressSummary["balance"] }) {
  const rows = balanceRows(balance).map((r) => ({ ...r, axis: AXIS_LABEL[r.key] }));
  const dot = ({ cx, cy, index }: DotProps) => {
    if (cx === undefined || cy === undefined) return <g key={index} />;
    const over = rows[index ?? 0]?.over;
    return <circle key={index} cx={cx} cy={cy} r={3.5} fill={over ? token("g-e") : token("brand-deep")} stroke={token("surface")} strokeWidth={1.5} />;
  };
  return (
    <EvilRadarChart
      config={config}
      data={rows}
      className="mx-auto aspect-auto size-[240px] flex-none"
      chartProps={{ outerRadius: R, margin: { top: 0, right: 0, bottom: 0, left: 0 } }}
    >
      <EvilRadarChart.PolarGrid gridType="circle" polarRadius={[25, 50, 75, 125, 150].map(ring)} stroke={token("line")} strokeOpacity={1} strokeDasharray="0" />
      <EvilRadarChart.PolarGrid gridType="circle" polarRadius={[ring(100)]} radialLines={false} stroke={token("muted")} strokeOpacity={1} strokeDasharray="3 3" />
      <EvilRadarChart.PolarRadiusAxis domain={[0, BALANCE_CAP]} tick={false} axisLine={false} />
      <EvilRadarChart.PolarAngleAxis dataKey="axis" tick={AXIS_TICK} />
      <EvilRadarChart.Radar
        dataKey="value"
        radarProps={{ fill: token("brand"), fillOpacity: 0.35, stroke: token("brand-deep"), strokeWidth: 2, strokeLinejoin: "round", dot, isAnimationActive: false }}
      />
    </EvilRadarChart>
  );
}
