import type { ChartConfig } from "@/components/charts/ui/recharts-chart";

// Every colour is a design token: the tokens themselves switch in dark mode (globals.css), so one
// "light" entry per series covers both themes; EvilCharts' ".dark" selector is never needed here.
export const token = (name: string) => `var(--${name})`;
export const series = (label: string, color: string): ChartConfig[string] => ({ label, colors: { light: [color] } });

/** Axis text (mock `.chart .ax`). */
export const AXIS_TICK = { fill: token("muted"), fontSize: 10.5, fontWeight: 500 } as const;
/** Reference-line labels (mock `.chart .ax.strong`). */
export const STRONG_LABEL = { fill: token("ink"), fontSize: 10.5, fontWeight: 650 } as const;
/** A halo in the card colour so a label stays readable where it crosses bars or a line. */
export const HALO = { stroke: token("surface"), strokeWidth: 3, paintOrder: "stroke", strokeLinejoin: "round" } as const;
