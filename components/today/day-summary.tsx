import { cn } from "@/lib/utils";
import type { TargetProgress } from "@/lib/nutrition/totals";

const r0 = (n: number) => Math.round(n);

function find(progress: TargetProgress[], key: TargetProgress["key"]): TargetProgress {
  const p = progress.find((x) => x.key === key);
  if (!p) throw new Error(`missing progress for ${key}`);
  return p;
}

function MacroRow({ p }: { p: TargetProgress }) {
  const pct = p.target > 0 ? Math.min(p.total / p.target, 1) * 100 : 0;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between text-sm font-medium">
        <span className="text-ink">{p.label}</span>
        <span className="num text-subtle">{r0(p.total)} / {r0(p.target)} g</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
        <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function LimitCell({ p, unit, toGoWord = "left" }: { p: TargetProgress; unit: string; toGoWord?: string }) {
  const ratio = p.target > 0 ? p.total / p.target : 0;
  const over = p.overBy > 0;
  const warn = !over && ratio > 0.8;
  return (
    <div className="p-3.5">
      <div className="text-sm text-subtle">{p.label}</div>
      <div className="num text-lg font-semibold">
        {r0(p.total)}
        <span className="text-sm font-normal text-subtle"> / {r0(p.target)} {unit}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sunken">
        <div className={cn("h-full rounded-full", over ? "bg-bad" : warn ? "bg-warn" : "bg-ink")} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
      </div>
      <div className={cn("mt-1 text-sm", over ? "text-bad" : "text-subtle")}>
        {over ? `over by ${r0(p.overBy)} ${unit}` : `${r0(p.remaining)} ${unit} ${toGoWord}`}
      </div>
    </div>
  );
}

export function DaySummary({ progress }: { progress: TargetProgress[] }) {
  const kcal = find(progress, "energyKcal");
  const protein = find(progress, "protein");
  const carbs = find(progress, "carbs");
  const fat = find(progress, "fat");
  const fibre = find(progress, "fibre");
  const sugar = find(progress, "sugarsMax");
  const sodium = find(progress, "sodiumMgMax");

  const circumference = 2 * Math.PI * 56;
  const pct = kcal.target > 0 ? Math.min(kcal.total / kcal.target, 1) : 0;
  const over = kcal.overBy > 0;
  const big = over ? kcal.overBy : kcal.remaining;

  return (
    <section aria-label="Today's totals" className="rounded-[18px] border border-line bg-surface shadow-card">
      <div className="grid grid-cols-[auto_1fr] items-center gap-6 p-5">
        <div role="img" aria-label={`${r0(kcal.total)} of ${r0(kcal.target)} kcal eaten`} className="relative size-[132px] shrink-0">
          <svg viewBox="0 0 132 132" className="size-full -rotate-90">
            <circle cx="66" cy="66" r="56" fill="none" stroke="var(--sunken)" strokeWidth="12" />
            <circle cx="66" cy="66" r="56" fill="none" stroke="var(--accent)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${circumference * pct} ${circumference}`} />
          </svg>
          <div className="absolute inset-0 grid place-content-center text-center">
            <div className={cn("num text-[32px] font-semibold tracking-[-0.035em]", over && "text-bad")}>{r0(big)}</div>
            <div className="text-sm text-subtle">{over ? "over by" : "kcal left"}</div>
          </div>
        </div>
        <div className="grid gap-3">
          <div className="text-sm text-subtle">
            <span className="num font-semibold text-ink">{r0(kcal.total)}</span> eaten of <span className="num">{r0(kcal.target)}</span> kcal
          </div>
          <MacroRow p={protein} />
          <MacroRow p={carbs} />
          <MacroRow p={fat} />
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-line border-t border-line">
        <LimitCell p={fibre} unit="g" toGoWord="to go" />
        <LimitCell p={sugar} unit="g" />
        <LimitCell p={sodium} unit="mg" />
      </div>
    </section>
  );
}
