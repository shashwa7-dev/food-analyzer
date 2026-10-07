import Link from "next/link";
import type { Range } from "@/lib/progress/aggregate";
import { cn } from "@/lib/utils";

const OPTIONS: { range: Range; label: string; href: string }[] = [
  { range: "week", label: "Week", href: "/progress" },
  { range: "month", label: "Month", href: "/progress?range=month" },
];

/**
 * Week / Month as two links (mock `.seg.mini`). Each pill is 34 px tall to match the mock; an
 * invisible ::after stretches the hit area to 44 px (design rule 6).
 */
export function RangeToggle({ range }: { range: Range }) {
  return (
    <nav aria-label="Range" className="inline-flex shrink-0 gap-1 rounded-full border border-line bg-surface p-1">
      {OPTIONS.map((o) => {
        const on = o.range === range;
        return (
          <Link
            key={o.range}
            href={o.href}
            aria-current={on ? "page" : undefined}
            scroll={false}
            className={cn(
              "relative inline-flex h-[34px] items-center whitespace-nowrap rounded-full px-3.5 text-[13px] font-[550] transition-colors",
              "after:absolute after:inset-x-0 after:-inset-y-[5px] after:content-['']",
              on ? "bg-action text-action-ink" : "text-subtle hover:text-ink",
            )}
          >
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}
