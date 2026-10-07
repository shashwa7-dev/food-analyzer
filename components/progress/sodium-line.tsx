"use client";

import { ReferenceLine } from "recharts";
import { EvilAreaChart } from "@/components/charts/recharts-area-chart";
import { ChartTooltip, ChartTooltipContent } from "@/components/charts/ui/recharts-tooltip";
import { useMatches } from "./use-matches";
import { labelSide, labelledDates, niceAxis, type SodiumPoint } from "@/lib/progress/chart-data";
import { compact, dayMonth, grouped, weekdayLetter, weekdayShort } from "@/lib/progress/copy";
import { AXIS_TICK, HALO, STRONG_LABEL, series, token } from "./chart-theme";

const config = { sodium: series("Sodium", token("warn")) };

type DotProps = { cx?: number; cy?: number; index?: number };

/**
 * Daily sodium as a smooth line over a soft fill, with a dashed limit line (spec §6.12). Points over
 * the limit fill red; the highest day is larger and carries its value. Days with no log are gaps.
 */
export default function SodiumLine({ points, limit }: { points: SodiumPoint[]; limit: number }) {
  const wide = useMatches("(min-width: 900px)");
  const isWeek = points.length <= 7;
  const peak = Math.max(0, ...points.map((p) => p.sodium ?? 0));
  const axis = niceAxis(peak, limit);
  const top = Math.max(axis.max, peak * 1.22); // room above the highest point for its value label
  const side = labelSide(points.map((p) => p.sodium), limit, { prefer: "left", below: true }); // under the line, as in the mock
  const tick = (date: string) => (isWeek ? (wide ? weekdayShort(date) : weekdayLetter(date)) : dayMonth(date));

  const dot = ({ cx, cy, index = 0 }: DotProps) => {
    const p = points[index];
    if (!p || p.sodium === null || cx === undefined || cy === undefined) return <g key={index} />;
    if (!isWeek && !p.over && !p.isMax) return <g key={index} />; // a month of dots is noise: keep the meaningful ones
    return (
      <g key={index}>
        <circle cx={cx} cy={cy} r={p.isMax ? 4.5 : 3} fill={p.over ? token("g-e") : token("surface")} stroke={token("warn")} strokeWidth={2} />
        {p.isMax && (
          <text x={cx} y={cy - 9} textAnchor="middle" {...STRONG_LABEL} {...HALO}>
            {grouped(p.sodium)}
          </text>
        )}
      </g>
    );
  };

  return (
    <EvilAreaChart
      config={config}
      data={points}
      curveType="monotone"
      className="aspect-auto h-[150px] md:h-[190px]"
      chartProps={{ accessibilityLayer: false, margin: { top: 20, right: 14, bottom: 0, left: 0 } }}
    >
      <EvilAreaChart.Grid stroke={token("line")} strokeDasharray="0" syncWithTicks />
      <EvilAreaChart.XAxis dataKey="date" ticks={labelledDates(points)} interval={0} tickFormatter={tick} tick={AXIS_TICK} tickMargin={6} padding={{ left: 6, right: 6 }} />
      <EvilAreaChart.YAxis domain={[0, top]} ticks={axis.ticks} tickFormatter={compact} tick={AXIS_TICK} width={30} allowDataOverflow />
      <ChartTooltip
        cursor={{ stroke: token("line"), strokeWidth: 1.5 }}
        content={<ChartTooltipContent labelFormatter={(d) => `${weekdayShort(String(d))} ${dayMonth(String(d))}`} formatter={(v) => `${grouped(Number(v))} mg sodium`} />}
      />
      <ReferenceLine
        y={limit}
        stroke={token("bad")}
        strokeWidth={1.5}
        strokeDasharray="5 4"
        ifOverflow="extendDomain"
        label={{ value: `Limit ${grouped(limit)} mg`, position: side === "left" ? "insideTopLeft" : "insideTopRight" /* Recharts' insideTop* = just below a horizontal line */, offset: 6, ...STRONG_LABEL, ...HALO, fill: token("bad") }}
      />
      <EvilAreaChart.Area dataKey="sodium" variant="gradient" strokeVariant="solid" strokeWidth={2.4} connectNulls areaProps={{ dataKey: "sodium", dot, activeDot: { r: 4, fill: token("warn"), stroke: token("surface") } }} />
    </EvilAreaChart>
  );
}
