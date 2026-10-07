import { Flame } from "lucide-react";

const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");

/**
 * The brand-soft "Eaten" card (spec §6.1): eaten kcal, the target, and a ring of % of goal. The
 * ring stops at 100% while the centre shows the true percentage, so an over-target day reads
 * "121%" on a full ring.
 */
export function CalorieCard({ eaten, target }: { eaten: number; target: number }) {
  const pct = target > 0 ? Math.round((eaten / target) * 100) : 0;
  const drawn = target > 0 ? Math.min((eaten / target) * 100, 100) : 0;
  return (
    <section
      aria-label="Calories eaten"
      className="flex items-center justify-between gap-2.5 rounded-[26px] bg-brand-soft py-[18px] pl-5 pr-[18px]"
    >
      <div className="min-w-0">
        <div className="inline-flex items-center gap-[5px] text-xs font-semibold uppercase tracking-[0.06em] text-subtle">
          <Flame className="size-3.5 text-brand-deep" aria-hidden />
          Eaten
        </div>
        <div className="num mt-2.5 whitespace-nowrap text-[44px] font-[650] leading-none tracking-[-0.045em] text-ink">
          {fmt(eaten)}
          <small className="ml-1 text-[15px] font-medium tracking-normal text-subtle">kcal</small>
        </div>
        <div className="num mt-1.5 whitespace-nowrap text-[13px] text-subtle">of {fmt(target)} target</div>
      </div>
      <div className="relative size-[112px] shrink-0 text-brand-deep" role="img" aria-label={`${pct}% of your calorie goal`}>
        <svg viewBox="0 0 112 112" width="112" height="112" className="block -rotate-90" aria-hidden>
          <circle cx="56" cy="56" r="47" fill="none" stroke="currentColor" strokeOpacity={0.16} strokeWidth="11" />
          {drawn > 0 && (
            <circle
              cx="56" cy="56" r="47" fill="none" stroke="currentColor" strokeWidth="11" strokeLinecap="round"
              pathLength={100} strokeDasharray={`${drawn} 100`}
            />
          )}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center leading-[1.1]" aria-hidden>
          <div>
            <b className="num block text-xl font-bold tracking-[-0.03em] text-ink">{pct}%</b>
            <span className="text-[11px] text-subtle">of goal</span>
          </div>
        </div>
      </div>
    </section>
  );
}
