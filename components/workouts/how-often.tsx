import type { StatsRange, TypeCount } from "@/lib/fitness/insights";
import { DAY_TYPE_META } from "@/components/workouts/day-type";
import { ProBadge } from "@/components/pro/pro-chip";
import { cn } from "@/lib/utils";

const CARD = "rounded-[24px] bg-surface shadow-card";

/** Sessions per day type in the range (workouts-full-v3.html `.trow`): a bar relative to the busiest type. */
export function HowOften({ items, range, className }: { items: TypeCount[]; range: StatsRange; className?: string }) {
  const max = Math.max(1, ...items.map((i) => i.sessions));
  return (
    <section aria-labelledby="fo-how-often" className={cn(CARD, "grid min-w-0 gap-1 p-3.5 md:p-4", className)}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 id="fo-how-often" className="m-0 inline-flex items-center gap-1.5 text-[15px] font-semibold whitespace-nowrap text-ink">
          How often
          <ProBadge size="sm" />
        </h2>
        <span className="shrink-0 text-[12px] whitespace-nowrap text-subtle">sessions</span>
      </div>
      {items.length === 0 ? (
        <p className="m-0 text-[13.5px] text-subtle">No sessions this {range} yet.</p>
      ) : (
        <div className="grid gap-1.5">
          {items.map((it) => {
            const meta = DAY_TYPE_META[it.type];
            return (
              <div key={it.type} className="grid grid-cols-[72px_1fr_22px] items-center gap-2 text-[12.5px]">
                <span className="truncate whitespace-nowrap text-ink">{meta.label}</span>
                <span className="h-[10px] overflow-hidden rounded-full bg-sunken">
                  <span className={cn("block h-full rounded-full", meta.bar)} style={{ width: `${(it.sessions / max) * 100}%` }} />
                </span>
                <b className="num text-right whitespace-nowrap text-ink">{it.sessions}</b>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
