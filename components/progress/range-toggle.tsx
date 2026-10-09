"use client";
import { useState } from "react";
import Link from "next/link";
import type { Range } from "@/lib/progress/aggregate";
import { cn } from "@/lib/utils";
import { ProBadge } from "@/components/pro/pro-chip";
import { UpgradeSheet } from "@/components/pro/upgrade-sheet";

const OPTIONS: { range: Range; label: string; href: string }[] = [
  { range: "week", label: "Week", href: "/progress" },
  { range: "month", label: "Month", href: "/progress?range=month" },
];

const PILL = cn(
  "relative inline-flex h-[34px] items-center whitespace-nowrap rounded-full px-3.5 text-[13px] font-[550] transition-colors",
  "after:absolute after:inset-x-0 after:-inset-y-[5px] after:content-['']",
);

/**
 * Week / Month as two links (mock `.seg.mini`). With `monthLocked` (Pro gate on, Basic plan) Month
 * carries the small Pro mark and opens the upgrade sheet instead (spec §B). Each pill is 34 px tall to
 * match the mock; an invisible ::after stretches the hit area to 44 px (design rule 6).
 */
export function RangeToggle({ range, monthLocked = false }: { range: Range; monthLocked?: boolean }) {
  const [upgrade, setUpgrade] = useState(false);
  return (
    <nav aria-label="Range" className="inline-flex shrink-0 gap-1 rounded-full border border-line bg-surface p-1">
      {OPTIONS.map((o) => {
        const on = o.range === range;
        if (monthLocked && o.range === "month") {
          return (
            <button key={o.range} type="button" onClick={() => setUpgrade(true)} aria-haspopup="dialog" aria-label={`${o.label}, a Pro feature`} className={cn(PILL, "text-subtle hover:text-ink")}>
              {o.label}
              <ProBadge size="sm" className="ml-1.5" />
            </button>
          );
        }
        return (
          <Link
            key={o.range}
            href={o.href}
            aria-current={on ? "page" : undefined}
            scroll={false}
            className={cn(PILL, on ? "bg-action text-action-ink" : "text-subtle hover:text-ink")}
          >
            {o.label}
          </Link>
        );
      })}
      {monthLocked && <UpgradeSheet open={upgrade} onOpenChange={setUpgrade} />}
    </nav>
  );
}
