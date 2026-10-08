"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { VolumeWeeks } from "@/lib/fitness/insights";
import { dayMonth } from "@/lib/progress/copy";
import { cn } from "@/lib/utils";

const HEIGHT = 190;
const PAD = { left: 34, right: 30, top: 12, bottom: 24 };

/** "12.4 t": tonnes, one decimal, the chart's own unit throughout. */
function fmtTonnes(kg: number): string {
  return `${(kg / 1000).toFixed(1)} t`;
}
/** "+1.8 t", "−0.4 t": always a sign (matching the en-dash convention in stat-tiles.tsx). */
function signedTonnes(kg: number): string {
  return `${kg < 0 ? "−" : "+"}${(Math.abs(kg) / 1000).toFixed(1)} t`;
}
function signedPct(pct: number): string {
  return `${pct < 0 ? "−" : "+"}${Math.abs(pct)}%`;
}
/** Gridline/tick labels: whole tonnes when the tick lands on one, else one decimal. */
function tickLabel(kg: number): string {
  const t = kg / 1000;
  return `${Number.isInteger(t) ? t : t.toFixed(1)} t`;
}

/**
 * Week-start x labels (chart-stack-or-switch-v2.html): "{d MMM}" the first time a month shows and
 * whenever it changes, else just the day number, so eight weeks of labels never crowd each other. The
 * last week is always "This wk".
 */
function weekLabels(weeks: { start: string }[]): string[] {
  let shownMonth = "";
  return weeks.map((w, i) => {
    if (i === weeks.length - 1) return "This wk";
    const full = dayMonth(w.start);
    const month = full.split(" ")[1]!;
    if (month !== shownMonth) {
      shownMonth = month;
      return full;
    }
    return full.split(" ")[0]!;
  });
}

/**
 * Measures the wrapper's own pixel width with a ResizeObserver (320 before the first client
 * measurement, so SSR and the first paint agree), and redraws the chart's geometry for that real
 * width every time it changes — the viewBox tracks it 1:1, so its text is never CSS-scaled.
 */
function useWidth(fallback = 320) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * Weekly volume, last 8 weeks (chart-stack-or-switch-v2.html): a hand-rolled SVG (no chart library),
 * a lime area + line with a hollow point per week and a bigger filled, labelled last point, three
 * gridlines from `axis.ticks` and a dashed average line. The big number, delta and the three chips
 * (Best / Avg / Trend) are plain HTML above and below it.
 */
export function VolumeChart({ volume, className }: { volume: VolumeWeeks; className?: string }) {
  const [measureRef, width] = useWidth();
  const tone = (n: number) => (n > 0 ? "text-brand-deep" : "text-subtle");
  const gid = useId();
  const { weeks, current, deltaVsLast, best, avg, trendPct, axis } = volume;

  const plotLeft = PAD.left;
  const plotRight = Math.max(plotLeft + 1, width - PAD.right);
  const plotTop = PAD.top;
  const plotBottom = HEIGHT - PAD.bottom;
  const span = axis.max - axis.min || 1;
  const yFor = (v: number) => plotTop + ((axis.max - v) / span) * (plotBottom - plotTop);
  const xFor = (i: number) => (weeks.length > 1 ? plotLeft + (i / (weeks.length - 1)) * (plotRight - plotLeft) : (plotLeft + plotRight) / 2);

  const pts = weeks.map((w, i) => ({ x: xFor(i), y: yFor(w.kg) }));
  const last = pts.at(-1);
  const firstWeek = weeks[0];
  const avgY = yFor(avg);
  const labels = weekLabels(weeks);
  const linePoints = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = last ? `M${pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L")} L${last.x.toFixed(1)} ${plotBottom} L${pts[0]!.x.toFixed(1)} ${plotBottom}Z` : "";

  return (
    <div className={cn("grid grid-cols-[minmax(0,1fr)] min-w-0 gap-2", className)}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <b className="num text-[22px] leading-none font-[650] tracking-[-0.03em] whitespace-nowrap text-ink">{fmtTonnes(current)}</b>
        <span className={cn("text-[12.5px] font-semibold whitespace-nowrap", tone(deltaVsLast))}>{signedTonnes(deltaVsLast)} vs last wk</span>
      </div>
      <div ref={measureRef} className="w-full">
        {weeks.length > 0 && last && firstWeek && (
          <svg
            viewBox={`0 0 ${width} ${HEIGHT}`}
            className="block h-auto w-full"
            role="img"
            aria-label={`Weekly volume, last ${weeks.length} weeks: ${fmtTonnes(firstWeek.kg)} to ${fmtTonnes(current)}`}
          >
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" style={{ stopColor: "var(--brand)", stopOpacity: 0.3 }} />
                <stop offset="1" style={{ stopColor: "var(--brand)", stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            <g stroke="var(--line)">
              {axis.ticks.map((t, i) => (
                <line key={i} x1={plotLeft} y1={yFor(t)} x2={plotRight} y2={yFor(t)} />
              ))}
            </g>
            <line x1={plotLeft} y1={avgY} x2={plotRight} y2={avgY} stroke="var(--muted)" strokeDasharray="3 4" />
            <text x={plotRight} y={avgY + 14} textAnchor="end" fontSize="11" className="text-subtle" fill="currentColor">
              avg {fmtTonnes(avg)}
            </text>
            <g fontSize="11" className="text-subtle" fill="currentColor">
              {axis.ticks.map((t, i) => (
                <text key={i} x={plotLeft - 8} y={yFor(t) + 4} textAnchor="end">
                  {tickLabel(t)}
                </text>
              ))}
            </g>
            <path d={areaPath} fill={`url(#${gid})`} />
            <polyline points={linePoints} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {pts.slice(0, -1).map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="var(--surface)" stroke="var(--brand)" strokeWidth="2" />
            ))}
            <circle cx={last.x} cy={last.y} r="5.5" fill="var(--brand)" stroke="var(--surface)" strokeWidth="2" />
            <text x={last.x} y={last.y - 11} textAnchor="middle" fontSize="11" fontWeight="600" className="text-ink" fill="currentColor">
              {(current / 1000).toFixed(1)}
            </text>
            <g fontSize="11" className="text-subtle" fill="currentColor">
              {pts.map((p, i) => (
                <text key={i} x={p.x} y={plotBottom + 19} textAnchor="middle">
                  {labels[i]}
                </text>
              ))}
            </g>
          </svg>
        )}
      </div>
      <div className="flex gap-1.5 text-[12px] text-subtle">
        <span className="min-w-0 flex-1 truncate rounded-[10px] bg-sunken px-2 py-1.5">
          Best <b className="text-ink">{fmtTonnes(best)}</b>
        </span>
        <span className="min-w-0 flex-1 truncate rounded-[10px] bg-sunken px-2 py-1.5">
          Avg <b className="text-ink">{fmtTonnes(avg)}</b>
        </span>
        <span className="min-w-0 flex-1 truncate rounded-[10px] bg-sunken px-2 py-1.5">
          Trend <b className={trendPct === null ? "text-ink" : tone(trendPct)}>{trendPct === null ? "–" : signedPct(trendPct)}</b>
        </span>
      </div>
    </div>
  );
}
