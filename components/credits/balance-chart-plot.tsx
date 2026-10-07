"use client";

import { useId } from "react";
import { ReferenceLine } from "recharts";
import { EvilAreaChart } from "@/components/charts/recharts-area-chart";
import { ChartTooltip, ChartTooltipContent } from "@/components/charts/ui/recharts-tooltip";
import { AXIS_TICK, HALO, STRONG_LABEL, series, token } from "@/components/progress/chart-theme";
import { dayMonth } from "@/lib/progress/copy";

export type BalancePoint = {
  date: string;
  /** Null after today: the dashed projection covers the rest of the period. */
  balance: number | null;
  event: boolean;
};

const config = { balance: series("Scans left", token("brand")) };

type DotProps = { cx?: number; cy?: number; index?: number };

/**
 * AI scans left per day this period (spec §6.14, mock "Credits & activity"): a step area in lime
 * with a brand-deep line, a hollow dot on each day a scan or refund changed it, a solid dot and
 * "Today · N" on today, and a dashed flat line from today to the period's last day.
 */
export default function BalanceChartPlot({ points, allowance, today, end }: { points: BalancePoint[]; allowance: number; today: string; end: string }) {
  const fillId = `credits-fill-${useId().replace(/:/g, "")}`;
  const todayIndex = points.findIndex((p) => p.date === today);
  const now = points[todayIndex]?.balance ?? 0;
  const top = Math.max(allowance, ...points.map((p) => p.balance ?? 0));
  const mid = Math.round(top / 2);
  const first = points[0]?.date;
  const middle = points[Math.floor((points.length - 1) / 2)]?.date;
  const ticks = [first, middle, end].filter((d, i, all): d is string => !!d && all.indexOf(d) === i);
  // Past the middle of the month the label sits left of the dot, so it never runs off the card.
  const labelLeft = todayIndex > (points.length - 1) * 0.6;

  const dot = ({ cx, cy, index = 0 }: DotProps) => {
    const p = points[index];
    if (!p || p.balance === null || cx === undefined || cy === undefined) return <g key={index} />;
    if (index === todayIndex) {
      return (
        <g key={index}>
          <circle cx={cx} cy={cy} r={5} fill={token("brand-deep")} />
          <text x={labelLeft ? cx - 9 : cx + 9} y={cy - 9} textAnchor={labelLeft ? "end" : "start"} {...STRONG_LABEL} {...HALO}>
            Today · {now}
          </text>
        </g>
      );
    }
    if (!p.event) return <g key={index} />;
    return <circle key={index} cx={cx} cy={cy} r={3.5} fill={token("surface")} stroke={token("brand-deep")} strokeWidth={2} />;
  };

  return (
    <EvilAreaChart
      config={config}
      data={points}
      curveType="stepAfter"
      className="aspect-auto h-[150px] md:h-[180px]"
      chartProps={{ accessibilityLayer: false, margin: { top: 22, right: 10, bottom: 0, left: 0 } }}
    >
      {/* The mock's fill (lime, .55 → .05): stronger than EvilCharts' 10% gradient, so the step reads at a glance. */}
      <defs>
        <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={token("brand")} stopOpacity={0.55} />
          <stop offset="1" stopColor={token("brand")} stopOpacity={0.05} />
        </linearGradient>
      </defs>
      <EvilAreaChart.Grid stroke={token("line")} strokeDasharray="0" vertical={false} syncWithTicks />
      <EvilAreaChart.XAxis
        dataKey="date"
        ticks={ticks}
        interval={0}
        tickFormatter={(d: string) => (d === first ? dayMonth(d) : String(Number(d.slice(8))))}
        tick={AXIS_TICK}
        tickMargin={6}
        padding={{ left: 4, right: 4 }}
      />
      <EvilAreaChart.YAxis domain={[0, top]} ticks={[0, mid, top]} tick={AXIS_TICK} width={28} allowDecimals={false} />
      <ChartTooltip
        cursor={{ stroke: token("line"), strokeWidth: 1.5 }}
        content={<ChartTooltipContent labelFormatter={(d) => dayMonth(String(d))} formatter={(v) => `${Number(v)} of ${allowance} left`} />}
      />
      {today !== end && (
        <ReferenceLine
          segment={[{ x: today, y: now }, { x: end, y: now }]}
          stroke={token("ink")}
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
      )}
      <EvilAreaChart.Area
        dataKey="balance"
        variant="gradient"
        strokeVariant="solid"
        strokeWidth={2.4}
        areaProps={{ dataKey: "balance", stroke: token("brand-deep"), fill: `url(#${fillId})`, fillOpacity: 1, dot, activeDot: { r: 4, fill: token("brand-deep"), stroke: token("surface") } }}
      />
    </EvilAreaChart>
  );
}
