"use client";
import { useState } from "react";
import { GradeBadge } from "@/components/grade-badge";
import { EntrySheet } from "@/components/today/entry-sheet";
import { portionMeta } from "@/lib/log/format";
import type { EntryRow } from "@/lib/log/service";

/** One diary entry inside an expanded meal card; tapping it opens the edit sheet. */
export function EntryRowButton({ entry }: { entry: EntryRow }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Edit ${entry.name}`}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors last:rounded-b-[24px] hover:bg-sunken/60"
      >
        <GradeBadge grade={entry.grade} size="sm" />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[14.5px] font-semibold text-ink">{entry.name}</span>
          <span className="block truncate text-[12.5px] text-subtle">{portionMeta(entry.portion)}</span>
        </span>
        <span className="num shrink-0 whitespace-nowrap text-right text-sm font-[650] leading-tight text-ink">
          {Math.round(entry.nutrients.energyKcal)}
          <small className="block text-[10.5px] font-medium text-subtle">kcal</small>
        </span>
      </button>
      {open && <EntrySheet entry={entry} open={open} onOpenChange={setOpen} />}
    </>
  );
}
