"use client";
import type { ScanMode } from "@/lib/scans/modes";
import { cn } from "@/lib/utils";
import { MODE_META, MODE_ORDER } from "./mode-meta";

/** The scanner's four frosted mode tiles (mock-c1 `.modes`); the active one is solid white. */
export function ModeTiles({ mode, onPick }: { mode: ScanMode; onPick: (mode: ScanMode) => void }) {
  return (
    <div role="group" aria-label="What are you scanning?" className="grid grid-cols-4 gap-2">
      {MODE_ORDER.map((m) => {
        const { label, icon: Icon } = MODE_META[m];
        return (
        <button
          key={m}
          type="button"
          aria-pressed={m === mode}
          onClick={() => onPick(m)}
          className={cn(
            "flex min-h-[66px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-[18px] border px-1 pt-3 pb-2.5 text-[11.5px] font-semibold whitespace-nowrap transition-colors",
            m === mode
              ? "border-on-media bg-on-media text-on-media-ink"
              : "border-on-media/20 bg-on-media/15 text-on-media backdrop-blur-[10px] hover:bg-on-media/25",
          )}
        >
          <Icon className="size-[22px]" aria-hidden />
          {label}
        </button>
        );
      })}
    </div>
  );
}
