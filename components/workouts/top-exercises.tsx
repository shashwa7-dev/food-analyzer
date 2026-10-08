import type { StatsRange, TopExercise } from "@/lib/fitness/insights";
import { ProBadge } from "@/components/pro/pro-chip";
import { cn } from "@/lib/utils";

const CARD = "rounded-[24px] bg-surface shadow-card";

/** 70×22 e1RM sparkline (workouts-full-v3.html `.spark`): nulls break the polyline rather than being skipped as a straight jump. */
function Sparkline({ values }: { values: (number | null)[] }) {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length < 2) return <svg className="h-[22px] w-[70px] shrink-0" viewBox="0 0 70 22" aria-hidden />;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const step = 70 / (values.length - 1);
  const groups: { x: number; y: number }[][] = [];
  let cur: { x: number; y: number }[] = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (cur.length) groups.push(cur);
      cur = [];
      return;
    }
    cur.push({ x: i * step, y: 20 - ((v - min) / span) * 18 });
  });
  if (cur.length) groups.push(cur);
  return (
    <svg className="h-[22px] w-[70px] shrink-0" viewBox="0 0 70 22" aria-hidden>
      {groups.map((g, i) => (
        <polyline
          key={i}
          points={g.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

function signedKg(delta: number): string {
  return `${delta < 0 ? "−" : "+"}${Math.abs(delta)} kg`;
}

function Row({ rank, ex }: { rank: number; ex: TopExercise }) {
  const meta = [`${ex.sets} ${ex.sets === 1 ? "set" : "sets"}`, `${ex.sessions} ${ex.sessions === 1 ? "session" : "sessions"}`, ex.best && `best ${ex.best.weightKg} kg × ${ex.best.reps}`].filter(Boolean).join(" · ");
  return (
    <div className="flex min-w-0 items-center gap-2.5 py-[7px]">
      <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-sunken text-[11px] font-bold text-subtle">{rank}</span>
      <div className="min-w-0 flex-1">
        <b className="block truncate text-[13.5px] font-semibold text-ink">{ex.name}</b>
        <span className="block truncate text-[12px] whitespace-nowrap text-subtle">{meta}</span>
      </div>
      <span className="hidden shrink-0 sm:block"><Sparkline values={ex.spark} /></span>
      {ex.e1rm !== null && (
        <span className="shrink-0 text-right text-[12.5px] leading-tight">
          <b className="block whitespace-nowrap text-brand-deep">e1RM {ex.e1rm} kg</b>
          {ex.e1rmDelta !== null && ex.e1rmDelta !== 0 && <span className="block whitespace-nowrap text-subtle">{signedKg(ex.e1rmDelta)}</span>}
        </span>
      )}
    </div>
  );
}

/**
 * Top exercises (workouts-full-v3.html): the 3 exercises with the most done sets in the range, each
 * with its set/session counts, best set, e1RM sparkline and delta. Always sits directly under
 * TrendsCard in the Pro slot, so it carries its own top margin rather than needing a wrapping gap.
 */
export function TopExercises({ items, range, className }: { items: TopExercise[]; range: StatsRange; className?: string }) {
  return (
    <section aria-labelledby="fo-top-exercises" className={cn(CARD, "mt-3.5 grid grid-cols-[minmax(0,1fr)] min-w-0 gap-1 p-3.5 md:p-4", className)}>
      <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
        <h2 id="fo-top-exercises" className="m-0 inline-flex items-center gap-1.5 text-[15px] font-semibold whitespace-nowrap text-ink">
          Top exercises
          <ProBadge size="sm" />
        </h2>
        <span className="shrink-0 text-[12px] whitespace-nowrap text-subtle">by sets this {range}</span>
      </div>
      {items.length === 0 ? (
        <p className="m-0 text-[13.5px] text-subtle">No sets logged this {range} yet.</p>
      ) : (
        <div className="min-w-0 divide-y divide-line">
          {items.map((ex, i) => (
            <Row key={ex.exerciseKey} rank={i + 1} ex={ex} />
          ))}
        </div>
      )}
    </section>
  );
}
