"use client";
import { useState } from "react";
import Link from "next/link";
import { ProBadge } from "@/components/pro/pro-chip";
import { UpgradeSheet } from "@/components/pro/upgrade-sheet";
import type { StatsRange } from "@/lib/fitness/insights";
import { cn } from "@/lib/utils";

const OPTIONS: { range: StatsRange; label: string; href: string }[] = [
  { range: "week", label: "Week", href: "/workouts" },
  { range: "month", label: "Month", href: "/workouts?range=month" },
];

const PILL = cn(
  "relative inline-flex h-[34px] items-center whitespace-nowrap rounded-full px-3.5 text-[13px] font-[550] transition-colors",
  "after:absolute after:inset-x-0 after:-inset-y-[5px] after:content-['']",
);

/**
 * Week / Month as two links (mock `.seg`, workouts-full-v3.html). With `locked` (Pro gate on, Basic
 * plan) Month carries the small Pro mark and opens the upgrade sheet instead of navigating (spec §B).
 */
export function RangeSwitch({ range, locked = false }: { range: StatsRange; locked?: boolean }) {
  const [upgrade, setUpgrade] = useState(false);
  return (
    <nav aria-label="Range" className="inline-flex shrink-0 gap-1 rounded-full border border-line bg-surface p-1">
      {OPTIONS.map((o) => {
        const on = o.range === range;
        if (locked && o.range === "month") {
          return (
            <button
              key={o.range}
              type="button"
              onClick={() => setUpgrade(true)}
              aria-haspopup="dialog"
              aria-label={`${o.label}, a Pro feature`}
              className={cn(PILL, "text-subtle hover:text-ink")}
            >
              {o.label}
              <ProBadge size="sm" className="ml-1.5" />
            </button>
          );
        }
        return (
          <Link key={o.range} href={o.href} aria-current={on ? "page" : undefined} scroll={false} className={cn(PILL, on ? "bg-action text-action-ink" : "text-subtle hover:text-ink")}>
            {o.label}
          </Link>
        );
      })}
      {locked && <UpgradeSheet open={upgrade} onOpenChange={setUpgrade} />}
    </nav>
  );
}
