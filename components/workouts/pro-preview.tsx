"use client";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { TrendsCard } from "@/components/workouts/trends-card";
import { TopExercises } from "@/components/workouts/top-exercises";
import { UpgradeSheet } from "@/components/pro/upgrade-sheet";
import { SAMPLE_CALENDAR, SAMPLE_TOP_EXERCISES, SAMPLE_VOLUME } from "@/components/workouts/sample-stats";

/**
 * The locked Pro slot (workouts-full-v3.html "Basic user, gates on"): a real TrendsCard + TopExercises
 * built from static sample data, blurred and `inert` behind a centred upsell overlay that opens the
 * upgrade sheet. This is the whole `proSlot` when `locked`; `proAside` is null (spec ruling).
 */
export function ProPreview() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <div aria-hidden inert className="grid grid-cols-[minmax(0,1fr)] min-w-0 opacity-55 blur-[5px]">
        <TrendsCard calendar={SAMPLE_CALENDAR} volume={SAMPLE_VOLUME} />
        <TopExercises items={SAMPLE_TOP_EXERCISES} range="month" />
      </div>
      <div className="absolute inset-0 grid place-items-center px-4 text-center">
        <div className="grid max-w-[280px] justify-items-center gap-2 rounded-[20px] bg-surface px-5 py-4 shadow-card">
          <b className="text-[15px] font-semibold text-ink">See your trends with Pro</b>
          <span className="text-[12.5px] text-subtle">
            Volume over 8 weeks, your top exercises, the monthly calendar and how often you train each day type.
          </span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            className="mt-1 inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-action px-4 text-[13.5px] font-semibold text-action-ink"
          >
            <Sparkles className="size-4" aria-hidden />
            See Pro
          </button>
        </div>
      </div>
      <UpgradeSheet open={open} onOpenChange={setOpen} />
    </div>
  );
}
