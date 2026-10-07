import Link from "next/link";
import { Lock } from "lucide-react";
import type { Range } from "@/lib/progress/aggregate";
import { cn } from "@/lib/utils";

const OPTIONS: { range: Range; label: string; href: string }[] = [
  { range: "week", label: "Week", href: "/progress" },
  { range: "month", label: "Month", href: "/progress?range=month" },
];

/**
 * Week / Month as two links (mock `.seg.mini`). With `monthLocked` (Pro gate on, Basic plan) Month
 * carries a small "Pro" lock chip and links to the plans instead. Each pill is 34 px tall to match the mock; an
 * invisible ::after stretches the hit area to 44 px (design rule 6).
 */
export function RangeToggle({ range, monthLocked = false }: { range: Range; monthLocked?: boolean }) {
  return (
    <nav aria-label="Range" className="inline-flex shrink-0 gap-1 rounded-full border border-line bg-surface p-1">
      {OPTIONS.map((o) => {
        const on = o.range === range;
        const locked = monthLocked && o.range === "month";
        return (
          <Link
            key={o.range}
            href={locked ? "/me/credits#pro" : o.href}
            aria-label={locked ? `${o.label}, a Pro feature` : undefined}
            aria-current={on ? "page" : undefined}
            scroll={locked ? undefined : false}
            className={cn(
              "relative inline-flex h-[34px] items-center whitespace-nowrap rounded-full px-3.5 text-[13px] font-[550] transition-colors",
              "after:absolute after:inset-x-0 after:-inset-y-[5px] after:content-['']",
              on ? "bg-action text-action-ink" : "text-subtle hover:text-ink",
            )}
          >
            {o.label}
            {locked && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-brand-soft px-1.5 py-px text-[10.5px] font-[650] text-on-brand-soft">
                <Lock className="size-2.5" aria-hidden />
                Pro
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
