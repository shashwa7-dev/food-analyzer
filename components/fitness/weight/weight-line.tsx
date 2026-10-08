"use client";

import { ReferenceLine } from "recharts";
import { EvilComposedChart } from "@/components/charts/recharts-composed-chart";
import { ChartTooltip, ChartTooltipContent } from "@/components/charts/ui/recharts-tooltip";
import { AXIS_TICK, series, token } from "@/components/progress/chart-theme";
import { dayMonth, weekdayShort } from "@/lib/progress/copy";
import { fmtWeight, weightAxis } from "@/lib/fitness/weight-view";
import type { WeightEntry } from "@/lib/fitness/types";

const config = { kg: series("Weight", token("brand-deep")) };

/** First, middle and last dates: three labels fit at phone width. */
function edgeTicks(points: WeightEntry[]): string[] {
  if (points.length <= 2) return points.map((p) => p.date);
  return [points[0]!.date, points[Math.floor((points.length - 1) / 2)]!.date, points.at(-1)!.date];
}

/**
 * Body weight over time as a line (spec §C screens 6–7), with the goal as a dashed reference line.
 * It fills its parent's height, which the caller fixes (so the placeholder has the same box).
 */
export default function WeightLine({ points, goal }: { points: WeightEntry[]; goal: number | null }) {
  const axis = weightAxis(points.map((p) => p.kg), goal);
  return (
    <EvilComposedChart
      config={config}
      data={points}
      curveType="monotone"
      className="aspect-auto h-full"
      chartProps={{ accessibilityLayer: false, margin: { top: 8, right: 14, bottom: 0, left: 0 } }}
    >
      <EvilComposedChart.Grid stroke={token("line")} strokeDasharray="0" syncWithTicks />
      <EvilComposedChart.XAxis dataKey="date" ticks={edgeTicks(points)} interval={0} tickFormatter={(d: string) => dayMonth(d)} tick={AXIS_TICK} tickMargin={6} padding={{ left: 6, right: 6 }} />
      <EvilComposedChart.YAxis domain={[axis.min, axis.max]} ticks={axis.ticks} tick={AXIS_TICK} width={30} allowDataOverflow />
      <ChartTooltip
        cursor={{ stroke: token("line"), strokeWidth: 1.5 }}
        content={<ChartTooltipContent labelFormatter={(d) => `${weekdayShort(String(d))} ${dayMonth(String(d))}`} formatter={(v) => `${fmtWeight(Number(v))} kg`} />}
      />
      {goal !== null && <ReferenceLine y={goal} stroke={token("ok")} strokeWidth={1.5} strokeDasharray="5 4" ifOverflow="extendDomain" />}
      <EvilComposedChart.Line dataKey="kg" connectNulls lineProps={{ dataKey: "kg", dot: points.length <= 12 ? { r: 2.5, fill: token("surface"), stroke: token("brand-deep"), strokeWidth: 2 } : false, activeDot: { r: 4, fill: token("brand-deep"), stroke: token("surface") } }} />
    </EvilComposedChart>
  );
}
