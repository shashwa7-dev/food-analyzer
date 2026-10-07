"use client";

import { useReducedMotion } from "motion/react";
import { useMatches } from "./use-matches";
import { EvilPieChart } from "@/components/charts/recharts-pie-chart";
import type { ChartConfig } from "@/components/charts/ui/recharts-chart";
import { cn } from "@/lib/utils";

export type DonutSlice = { name: string; value: number; color: string };

/**
 * A flat ring (mock `.donut`): slices start at 12 o'clock and run clockwise, with a centre label.
 * Shared by Macro split and Food quality; their legends are server-rendered beside it.
 */
export default function Donut({ slices, center, size, thickness, mountWhen }: {
  slices: DonutSlice[]; center: string; size: number; thickness: number;
  /** A media query under which the card is visible; outside it the chart isn't mounted (Recharts can't size a display:none box). */
  mountWhen?: string;
}) {
  const reduce = useReducedMotion();
  const visible = useMatches(mountWhen ?? "all");
  const data = slices.filter((s) => s.value > 0);
  const config: ChartConfig = Object.fromEntries(slices.map((s) => [s.name, { label: s.name, colors: { light: [s.color] } }]));
  const inner = Math.round(((size / 2 - thickness) / (size / 2)) * 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {!visible ? null : data.length === 0 ? (
        <div className="size-full rounded-full border-sunken" style={{ borderWidth: thickness }} />
      ) : (
        <EvilPieChart config={config} data={data} dataKey="value" nameKey="name" className={cn("aspect-auto size-full")} chartProps={{ accessibilityLayer: false, margin: { top: 0, right: 0, bottom: 0, left: 0 } }}>
          <EvilPieChart.Pie innerRadius={`${inner}%`} outerRadius="100%" startAngle={90} endAngle={-270} pieProps={{ isAnimationActive: !reduce }} />
        </EvilPieChart>
      )}
      <span className="num pointer-events-none absolute inset-0 grid place-items-center text-[17px] font-bold tracking-[-0.03em] text-ink">{center}</span>
    </div>
  );
}
