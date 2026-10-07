"use client";

import { useId } from "react";
import { ReferenceLine } from "recharts";
import { EvilComposedChart, type BarStyle } from "@/components/charts/recharts-composed-chart";
import { ChartTooltip, ChartTooltipContent } from "@/components/charts/ui/recharts-tooltip";
import { useMatches } from "./use-matches";
import type { CalorieBar } from "@/lib/progress/chart-data";
import { labelledDates, niceAxis } from "@/lib/progress/chart-data";
import { compact, dayMonth, grouped, weekdayLetter, weekdayShort } from "@/lib/progress/copy";
import { AXIS_TICK, series, token } from "./chart-theme";

const config = { kcal: series("Calories", token("brand")) };

/**
 * Daily kcal bars against a dashed target line (spec §6.12); its label is a key in the card header.
 * Bars above the on-target band are hatched in --fat on --fat-soft, today's bar is --brand-soft (with a --brand edge so it still reads on the dark surface).
 */
export default function CaloriesChart({ bars, target }: { bars: CalorieBar[]; target: number }) {
  const hatchId = `kcal-hatch-${useId().replace(/:/g, "")}`;
  const wide = useMatches("(min-width: 900px)");
  const isWeek = bars.length <= 7;
  const axis = niceAxis(Math.max(0, ...bars.map((b) => b.kcal)), target);
  const ticks = labelledDates(bars);
  const tick = (date: string) => (isWeek ? (wide ? weekdayShort(date) : weekdayLetter(date)) : dayMonth(date));

  const styleFor = (row: Record<string, unknown>): BarStyle | undefined => {
    const b = row as unknown as CalorieBar;
    if (b.over) return { fill: `url(#${hatchId})`, stroke: token("fat"), strokeWidth: 1.2 };
    if (b.isToday) return { fill: token("brand-soft"), stroke: token("brand"), strokeWidth: 1 };
    return undefined;
  };

  return (
    <EvilComposedChart
      config={config}
      data={bars}
      className="aspect-auto h-[170px] md:h-[220px]"
      chartProps={{ accessibilityLayer: false, barCategoryGap: isWeek ? "28%" : "18%", margin: { top: 8, right: isWeek ? 2 : 14, bottom: 0, left: 0 } }}
    >
      <defs>
        <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill={token("fat-soft")} />
          <line x1="0" y1="0" x2="0" y2="6" stroke={token("fat")} strokeWidth="2.5" />
        </pattern>
      </defs>
      <EvilComposedChart.Grid stroke={token("line")} strokeDasharray="0" syncWithTicks />
      <EvilComposedChart.XAxis dataKey="date" ticks={ticks} interval={0} tickFormatter={tick} tick={AXIS_TICK} tickMargin={6} />
      <EvilComposedChart.YAxis domain={[0, axis.max]} ticks={axis.ticks} tickFormatter={compact} tick={AXIS_TICK} width={30} allowDataOverflow />
      <ChartTooltip
        cursor={{ fill: token("sunken"), opacity: 0.6 }}
        content={<ChartTooltipContent labelFormatter={(d) => `${weekdayShort(String(d))} ${dayMonth(String(d))}`} formatter={(v) => `${grouped(Number(v))} kcal`} />}
      />
      <EvilComposedChart.Bar dataKey="kcal" radius={isWeek ? 6 : 3} getBarStyle={styleFor} />
      <ReferenceLine
        y={target}
        stroke={token("ink")}
        strokeWidth={1.5}
        strokeDasharray="5 4"
        ifOverflow="extendDomain"
      />
    </EvilComposedChart>
  );
}
