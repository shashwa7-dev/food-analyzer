import { Drumstick, Flame, Target, Zap, type LucideIcon } from "lucide-react";
import type { ProgressSummary } from "@/lib/progress/aggregate";
import { grouped } from "@/lib/progress/copy";
import { cn } from "@/lib/utils";

type Tile = { key: string; icon: LucideIcon; value: string; deskValue?: string; label: string; deskLabel?: string; deskOnly?: boolean; sr: string };

/** KPI tiles (spec §6.12): 3 on phones; desktop adds average protein and longer labels, as in the mock. */
export function Kpis({ kpis }: { kpis: ProgressSummary["kpis"] }) {
  const tiles: Tile[] = [
    { key: "kcal", icon: Flame, value: grouped(kpis.avgKcal), label: "avg kcal", deskLabel: "avg kcal a day", sr: `${grouped(kpis.avgKcal)} kcal a day on average` },
    { key: "target", icon: Target, value: `${kpis.daysOnTarget}/${kpis.daysLogged}`, deskValue: `${kpis.daysOnTarget} of ${kpis.daysLogged}`, label: "on target", deskLabel: "days on target", sr: `${kpis.daysOnTarget} of ${kpis.daysLogged} logged days on target` },
    { key: "protein", icon: Drumstick, value: `${kpis.avgProtein} g`, label: "avg protein", deskOnly: true, sr: `${kpis.avgProtein} grams of protein a day on average` },
    { key: "streak", icon: Zap, value: `${kpis.streak}${kpis.streakCapped ? "+" : ""}`, label: "day streak", sr: `${kpis.streakCapped ? "At least " : ""}${kpis.streak} day logging streak` },
  ];
  return (
    <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0 md:col-span-2 md:grid-cols-4 md:gap-3">
      {tiles.map((t) => (
        <li key={t.key} className={cn("grid min-w-0 gap-0.5 rounded-[20px] bg-surface p-3 shadow-card md:p-4", t.deskOnly && "hidden md:grid")}>
          <t.icon className="mb-1 size-[18px] text-brand-deep" aria-hidden />
          <span className="sr-only">{t.sr}</span>
          <b aria-hidden className="num truncate whitespace-nowrap text-xl font-[650] tracking-[-0.03em] text-ink md:text-[22px]">
            {t.deskValue ? <><span className="md:hidden">{t.value}</span><span className="hidden md:inline">{t.deskValue}</span></> : t.value}
          </b>
          <span aria-hidden className="truncate whitespace-nowrap text-xs text-subtle">
            {t.deskLabel ? <><span className="md:hidden">{t.label}</span><span className="hidden md:inline">{t.deskLabel}</span></> : t.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
