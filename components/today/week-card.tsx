import { useId } from "react";
import { BarChart3 } from "lucide-react";
import { RailCard, RailCardHead, RailCardLink } from "@/components/today/rail-card";
import type { ProgressSummary } from "@/lib/progress/aggregate";
import { calorieBars } from "@/lib/progress/chart-data";
import { grouped, weekdayLetter, weekdayShort } from "@/lib/progress/copy";
import type { Goal } from "@/lib/nutrition/types";
import { cn } from "@/lib/utils";

// The mini chart's geometry, in viewBox units (mock-c1 option A): 7 bars of 22 across 260, an 80
// tall plot and the weekday letters under it.
const W = 260, PLOT = 80, BAR = 22, H = 96;
const GAP = (W - 7 * BAR) / 6;

/**
 * This week (mock-c1 option A): the last 7 days' kcal as mini bars against a dashed target line, with
 * the Progress calories chart's colours and hatch rule (calorieBars: over the on-target band is
 * hatched, today is brand-soft with a brand edge, a day with nothing logged has no bar), then three
 * mini KPIs from the same week summary.
 */
export function WeekCard({ week, goal, className }: { week: ProgressSummary; goal: Goal; className?: string }) {
  const titleId = useId();
  const hatchId = `week-hatch-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const target = week.targets.energyKcal;
  const today = week.days.at(-1)?.date ?? "";
  const bars = calorieBars(week.days, target, today, goal);
  // 10% headroom over the taller of the biggest day and the target line, as on Progress.
  const max = Math.max(target, ...bars.map((b) => b.kcal), 1) * 1.1;
  const y = (kcal: number) => PLOT - (kcal / max) * PLOT;
  const over = bars.filter((b) => b.over).length;
  const { avgKcal, daysOnTarget, daysLogged, streak, streakCapped } = week.kpis;
  const kpis = [
    { value: grouped(avgKcal), label: "avg kcal", sr: `${grouped(avgKcal)} kcal a day on average` },
    { value: `${daysOnTarget}/${daysLogged}`, label: "on target", sr: `${daysOnTarget} of ${daysLogged} logged days on target` },
    { value: `${streak}${streakCapped ? "+" : ""}`, label: "day streak", sr: `${streakCapped ? "At least " : ""}${streak} day logging streak` },
  ];

  return (
    <RailCard labelledBy={titleId} className={className}>
      <RailCardHead id={titleId} icon={BarChart3} title="This week">
        <RailCardLink href="/progress">Progress</RailCardLink>
      </RailCardHead>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full overflow-visible"
        role="img"
        aria-label={`Calories for the last 7 days against a ${grouped(target)} kcal target${over ? `; ${over} ${over === 1 ? "day" : "days"} over` : ""}`}
      >
        <defs>
          <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" className="fill-fat-soft" />
            <line x1="0" y1="0" x2="0" y2="6" className="stroke-fat" strokeWidth="2.5" />
          </pattern>
        </defs>
        {bars.map((b, i) => {
          const x = i * (BAR + GAP);
          const top = y(b.kcal);
          const h = PLOT - top;
          return (
            <g key={b.date}>
              {b.logged && h > 0 && (
                <rect
                  x={x} y={top} width={BAR} height={h} rx={Math.min(6, h / 2)}
                  fill={b.over ? `url(#${hatchId})` : undefined}
                  className={cn(b.over ? "stroke-fat" : b.isToday ? "fill-brand-soft stroke-brand" : "fill-brand")}
                  strokeWidth={b.over || b.isToday ? 1 : 0}
                >
                  <title>{`${weekdayShort(b.date)}: ${grouped(b.kcal)} kcal`}</title>
                </rect>
              )}
              <text
                x={x + BAR / 2} y={H - 2} textAnchor="middle"
                className={cn("text-[10.5px]", b.isToday ? "fill-ink font-[650]" : "fill-subtle font-medium")}
                aria-hidden
              >
                {weekdayLetter(b.date)}
              </text>
            </g>
          );
        })}
        <line x1="0" x2={W} y1={y(target)} y2={y(target)} className="stroke-ink" strokeWidth="1.5" strokeDasharray="5 4" />
      </svg>
      <ul className="m-0 grid list-none grid-cols-3 gap-1.5 p-0">
        {kpis.map((k) => (
          <li key={k.label} className="grid min-w-0 rounded-[12px] bg-sunken p-2 leading-tight">
            <span className="sr-only">{k.sr}</span>
            <b aria-hidden className="num truncate text-[17px] font-[650] tracking-[-0.02em] whitespace-nowrap text-ink">{k.value}</b>
            <span aria-hidden className="truncate text-[11.5px] whitespace-nowrap text-subtle">{k.label}</span>
          </li>
        ))}
      </ul>
    </RailCard>
  );
}
