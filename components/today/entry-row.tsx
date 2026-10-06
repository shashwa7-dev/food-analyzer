"use client";
import { useState } from "react";
import { GradeBadge } from "@/components/grade-badge";
import { EntrySheet } from "@/components/today/entry-sheet";
import { portionMeta } from "@/lib/log/format";
import type { EntryRow } from "@/lib/log/service";

export function EntryRowButton({ entry }: { entry: EntryRow }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Edit ${entry.name}`}
        className="flex min-h-14 w-full items-center gap-3.5 border-t border-line px-5 py-3 text-left"
      >
        <GradeBadge grade={entry.grade} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{entry.name}</span>
          <span className="block text-sm text-subtle">{portionMeta(entry.portion)}</span>
        </span>
        <span className="num shrink-0 font-semibold">{Math.round(entry.nutrients.energyKcal)}</span>
      </button>
      {open && <EntrySheet entry={entry} open={open} onOpenChange={setOpen} />}
    </>
  );
}
