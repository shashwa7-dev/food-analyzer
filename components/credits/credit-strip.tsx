import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";

/**
 * The Me page's credit strip (mock-c1 `.xcredit`): scans left, a thin bar and the plan's reset
 * date, on --brand-soft. Opens the credits page.
 */
export function CreditStrip({ credits, allowance, planLabel, resetsLabel }: { credits: number; allowance: number; planLabel: string; resetsLabel: string }) {
  const pct = allowance > 0 ? (Math.max(0, Math.min(credits, allowance)) / allowance) * 100 : 0;
  return (
    <Link href="/me/credits" className="flex items-center gap-3 rounded-[20px] bg-brand-soft px-4 py-3.5 text-ink transition-[filter] hover:brightness-[0.98]">
      <Sparkles className="size-[22px] shrink-0 text-brand-deep" aria-hidden />
      <span className="grid min-w-0 flex-1 gap-1.5">
        <b className="num truncate text-[15px] font-semibold">{credits} of {allowance} AI scans left</b>
        <span className="block h-1.5 overflow-hidden rounded-full bg-surface/75" aria-hidden>
          <span className="block h-full rounded-full bg-brand-deep" style={{ width: `${pct}%` }} />
        </span>
        <span className="num truncate text-[12.5px] text-subtle">{planLabel} · resets {resetsLabel}</span>
      </span>
      <ChevronRight className="size-[18px] shrink-0 text-subtle" aria-hidden />
    </Link>
  );
}
