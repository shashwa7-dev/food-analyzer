"use client";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { UpgradeSheet } from "@/components/pro/upgrade-sheet";

/** The small "Pro" mark (Sparkles plus "Pro") on its own, for a locked control that opens the upgrade sheet itself. */
export function ProBadge({ size = "md", className }: { size?: "sm" | "md"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full bg-brand-soft font-[650] whitespace-nowrap text-on-brand-soft",
        size === "sm" ? "gap-0.5 px-1.5 py-px text-[10.5px]" : "gap-1 px-2.5 py-1 text-[12px]",
        className,
      )}
    >
      <Sparkles className={size === "sm" ? "size-2.5" : "size-3"} aria-hidden />
      Pro
    </span>
  );
}

/**
 * The Pro lock chip (spec §B): marks a control that's Pro-only while the gates are on and opens the
 * upgrade sheet. `feature` names it for screen readers ("Custom targets").
 */
export function ProChip({ feature }: { feature: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`${feature}: part of Pro. See plans`}
        className="-my-2 inline-flex min-h-11 shrink-0 items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand-deep"
      >
        <ProBadge />
      </button>
      <UpgradeSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
