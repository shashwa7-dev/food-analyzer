"use client";
import type { ReactNode } from "react";
import { Check, Loader2, Plus, Sparkles, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScanMode } from "@/lib/scans/modes";
import { cn } from "@/lib/utils";

export type TrayPhoto = { id: string; url: string };

/**
 * The review step's white bottom panel (spec §6.9, mock-c1 `.tray`): numbered thumbnails (tap to
 * view one behind the tray, × to remove), an add slot back to the camera, a hint about what else to
 * capture, and "Analyse photos" with its cost chip. `notice` holds any error to show above the button.
 */
export function ReviewTray({ photos, selected, onSelect, onRemove, onAdd, mode, onAnalyse, pending, disabled, notice }: {
  photos: TrayPhoto[];
  selected: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  /** Null once the tray is full (MAX_IMAGES). */
  onAdd: (() => void) | null;
  mode: ScanMode;
  onAnalyse: () => void;
  pending: boolean;
  disabled: boolean;
  notice?: ReactNode;
}) {
  return (
    <div className="relative mt-auto grid gap-3.5 rounded-t-[30px] bg-surface px-[18px] pt-[18px] pb-[calc(26px+env(safe-area-inset-bottom))] text-ink md:pb-[26px]">
      <ul className="m-0 flex list-none gap-2.5 p-0" aria-label="Photos">
        {photos.map((p, i) => (
          <li key={p.id} className="relative h-[92px] w-[74px] shrink-0">
            <button
              type="button"
              onClick={() => onSelect(p.id)}
              aria-pressed={p.id === selected}
              aria-label={`Photo ${i + 1}`}
              className={cn(
                "block size-full overflow-hidden rounded-[18px] bg-sunken transition-shadow",
                p.id === selected && "ring-[3px] ring-brand",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob: preview, never stored or optimised */}
              <img src={p.url} alt="" className="size-full object-cover" />
            </button>
            <span
              aria-hidden
              className="pointer-events-none absolute top-1.5 left-1.5 grid size-5 place-items-center rounded-full bg-viewfinder/60 text-[11px] font-bold text-on-media"
            >
              {i + 1}
            </span>
            <button
              type="button"
              onClick={() => onRemove(p.id)}
              aria-label={`Remove photo ${i + 1}`}
              className="absolute -top-2.5 -right-2.5 grid size-11 place-items-center"
            >
              <span className="grid size-6 place-items-center rounded-full bg-viewfinder text-on-media ring-2 ring-surface">
                <X className="size-3.5" strokeWidth={2.5} aria-hidden />
              </span>
            </button>
          </li>
        ))}
        {onAdd && (
          <li className="h-[92px] w-[74px] shrink-0">
            <button
              type="button"
              onClick={onAdd}
              aria-label="Add another photo"
              className="grid size-full place-items-center rounded-[18px] border-[1.5px] border-dashed border-line text-subtle transition-colors hover:bg-sunken"
            >
              <Plus className="size-6" aria-hidden />
            </button>
          </li>
        )}
      </ul>
      <p className="m-0 flex items-center gap-2 text-[13px] leading-snug text-subtle">
        <Check className="size-4 shrink-0 text-brand-deep" aria-hidden />
        {mode === "meal" ? "Add another angle if part of the plate is hidden." : "Front and label. Add one more angle if the table is cut off."}
      </p>
      {notice}
      <Button type="button" shape="pill" size="xl" className="h-[54px] w-full" disabled={disabled} onClick={onAnalyse}>
        {pending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Zap aria-hidden />}
        {pending ? "Sending…" : "Analyse photos"}
        {!pending && (
          <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-action-ink/15 px-[9px] py-[3px] text-[12.5px] font-semibold">
            <Sparkles className="size-[13px]" aria-hidden />
            1 scan
          </span>
        )}
      </Button>
    </div>
  );
}
