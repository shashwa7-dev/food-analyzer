import { Dumbbell, Flame, Target } from "lucide-react";
import type { EnergyLine } from "@/lib/today/energy";

const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");

function Part({ icon: Icon, label, value, sub, net }: { icon: typeof Flame; label: string; value: number; sub?: string; net?: boolean }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold tracking-[0.06em] whitespace-nowrap text-subtle uppercase">
        <Icon className="size-[13px] shrink-0" aria-hidden />
        {label}
      </span>
      <b className={`num text-[24px] leading-[1.05] font-[650] tracking-[-0.03em] whitespace-nowrap ${net ? "text-brand-deep" : "text-ink"}`}>{fmt(value)}</b>
      {sub && <span className="num truncate text-[11.5px] whitespace-nowrap text-subtle">{sub}</span>}
    </div>
  );
}

const Op = ({ children }: { children: string }) => (
  <span className="shrink-0 text-[20px] font-semibold text-subtle" aria-hidden>
    {children}
  </span>
);

/**
 * "Eaten − Burned = Net of {target}" (spec §C screen 5, mock-c1 `.wk-bal`). Shown only on days with a
 * workout; the target is the day's calorie target, unchanged (no eat-back).
 */
export function EnergyStrip({ line }: { line: EnergyLine }) {
  return (
    <section
      aria-label={`Energy balance: ${fmt(line.eaten)} eaten minus ${fmt(line.burned)} burned is ${fmt(line.net)} net of ${fmt(line.target)} kcal`}
      className="flex items-center justify-between gap-1.5 rounded-[24px] bg-brand-soft p-4"
    >
      <Part icon={Flame} label="Eaten" value={line.eaten} />
      <Op>−</Op>
      <Part icon={Dumbbell} label="Burned" value={line.burned} />
      <Op>=</Op>
      <Part icon={Target} label="Net" value={line.net} sub={`of ${fmt(line.target)}`} net />
    </section>
  );
}
