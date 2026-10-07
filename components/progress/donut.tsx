"use client";

import { useMemo } from "react";
import { useReducedMotion } from "motion/react";
import { ResponsiveContainer } from "recharts";
import { EvilPieChart } from "@/components/charts/recharts-pie-chart";
import type { ChartConfig } from "@/components/charts/ui/recharts-chart";

export type DonutSlice = { name: string; value: number; color: string };

/**
 * A flat ring (mock `.donut`): slices start at 12 o'clock and run clockwise with a 2° gap between
 * segments (as in the mock), and a centre label. Shared by Macro split and Food quality; their legends are
 * server-rendered beside it.
 *
 * The outer ResponsiveContainer has numeric width/height, so Recharts never measures the DOM (no
 * zero-size first pass, no warning inside a display:none card) and the EvilCharts container nested
 * inside it uses that fixed size as-is.
 */
export default function Donut({ slices, center, size, thickness }: { slices: DonutSlice[]; center: string; size: number; thickness: number }) {
  const reduce = useReducedMotion();
  // Stable references: a new data/config object each render would restart the pie's entry animation.
  const data = useMemo(() => slices.filter((s) => s.value > 0), [slices]);
  const config = useMemo<ChartConfig>(() => Object.fromEntries(slices.map((s) => [s.name, { label: s.name, colors: { light: [s.color] } }])), [slices]);
  const inner = Math.round(((size / 2 - thickness) / (size / 2)) * 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {data.length === 0 ? (
        <div className="size-full rounded-full border-sunken" style={{ borderWidth: thickness }} />
      ) : (
        <ResponsiveContainer width={size} height={size}>
          <EvilPieChart config={config} data={data} dataKey="value" nameKey="name" className="aspect-auto size-full" chartProps={{ accessibilityLayer: false, margin: { top: 0, right: 0, bottom: 0, left: 0 } }}>
            <EvilPieChart.Pie
              innerRadius={`${inner}%`}
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={data.length > 1 ? 2 : 0}
              pieProps={{ isAnimationActive: !reduce }}
            />
          </EvilPieChart>
        </ResponsiveContainer>
      )}
      <span className="num pointer-events-none absolute inset-0 grid place-items-center text-[17px] font-bold tracking-[-0.03em] text-ink">{center}</span>
    </div>
  );
}
