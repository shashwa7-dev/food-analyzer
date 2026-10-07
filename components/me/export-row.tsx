"use client";
import { useState } from "react";
import { ChevronRight, Download, Dumbbell, NotebookText, Scale, ScanLine, type LucideIcon } from "lucide-react";
import { ResponsiveSheet, SheetTitle } from "@/components/ui/responsive-sheet";
import { IconTile } from "@/components/ui/icon-tile";
import { ProBadge } from "@/components/pro/pro-chip";
import { UpgradeSheet } from "@/components/pro/upgrade-sheet";
import { usePro } from "@/components/pro/pro-context";
import type { ExportKind } from "@/lib/export/service";

// The four exports (GET /api/v1/export?what=). Workouts and weight come with the fitness tracker
// (Phase 2 Task 3): until then the API answers 400 NOT_AVAILABLE, so they show as "Soon".
const EXPORTS: { what: ExportKind; icon: LucideIcon; label: string; hint: string; ready: boolean }[] = [
  { what: "diary", icon: NotebookText, label: "Diary", hint: "Everything you've logged", ready: true },
  { what: "scans", icon: ScanLine, label: "Scans", hint: "Your scan history", ready: true },
  { what: "workouts", icon: Dumbbell, label: "Workouts", hint: "Sessions and sets", ready: false },
  { what: "weight", icon: Scale, label: "Weight", hint: "Your weigh-ins", ready: false },
];

const ROW = "flex min-h-[54px] w-full items-center gap-3.5 px-4 text-left not-first:border-t not-first:border-line";

/**
 * Me's "Export data" row (spec §B): a small sheet with the four CSV downloads. With the gates on and
 * the plan on Basic it carries the Pro mark and opens the upgrade sheet instead.
 */
export function ExportRow() {
  const { locks } = usePro();
  const locked = locks.dataExport;
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="overflow-hidden rounded-[20px] bg-surface shadow-card">
        <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={locked ? "Export data, a Pro feature" : undefined} className={`${ROW} text-ink transition-colors hover:bg-sunken/60`}>
          <Download className="size-5 shrink-0 text-subtle" aria-hidden />
          <span className="shrink-0 font-[550] whitespace-nowrap">Export data</span>
          <span className="ml-auto flex min-w-0 items-center justify-end">
            {locked ? <ProBadge /> : <span className="truncate text-[14px] text-subtle">CSV</span>}
          </span>
          <ChevronRight className="size-[18px] shrink-0 text-subtle" aria-hidden />
        </button>
      </div>
      {locked ? <UpgradeSheet open={open} onOpenChange={setOpen} /> : <ExportSheet open={open} onOpenChange={setOpen} />}
    </>
  );
}

function ExportSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange}>
      <div className="flex items-center gap-3">
        <IconTile tone="brand" size="md"><Download aria-hidden /></IconTile>
        <div className="min-w-0 flex-1 leading-tight">
          <SheetTitle className="block truncate text-[18px] font-semibold tracking-[-0.02em] text-ink">Export data</SheetTitle>
          <span className="block truncate text-[13px] text-subtle">A CSV file for any spreadsheet</span>
        </div>
      </div>
      <ul className="m-0 list-none overflow-hidden rounded-[20px] bg-surface p-0 shadow-card">
        {EXPORTS.map(({ what, icon: Icon, label, hint, ready }) => {
          const body = (
            <>
              <Icon className="size-5 shrink-0 text-subtle" aria-hidden />
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate font-[550] whitespace-nowrap">{label}</span>
                <span className="truncate text-[12.5px] text-subtle">{hint}</span>
              </span>
              {ready ? <Download className="size-[18px] shrink-0 text-subtle" aria-hidden /> : <span className="shrink-0 text-[13px] whitespace-nowrap text-subtle">Soon</span>}
            </>
          );
          return (
            <li key={what} className="not-first:border-t not-first:border-line">
              {ready ? (
                <a href={`/api/v1/export?what=${what}`} download className="flex min-h-[58px] items-center gap-3.5 px-4 text-ink transition-colors hover:bg-sunken/60" aria-label={`Download ${label.toLowerCase()} as CSV`}>
                  {body}
                </a>
              ) : (
                <div aria-disabled="true" className="flex min-h-[58px] items-center gap-3.5 px-4 text-ink opacity-60">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </ResponsiveSheet>
  );
}
