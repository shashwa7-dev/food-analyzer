"use client";
import { Sparkles } from "lucide-react";
import { ResponsiveSheet, SheetTitle } from "@/components/ui/responsive-sheet";
import { IconTile } from "@/components/ui/icon-tile";
import { PlanCards } from "@/components/credits/plan-cards";

/**
 * The upgrade sheet (spec §B): what every Pro lock opens instead of its action. Basic beside Pro
 * ("Everything in Basic, plus…") with Join the waitlist, the same plan cards as /me/credits#pro.
 */
export function UpgradeSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange}>
      <div className="flex items-center gap-3">
        <IconTile tone="brand" size="md"><Sparkles aria-hidden /></IconTile>
        <div className="min-w-0 flex-1 leading-tight">
          <SheetTitle className="block truncate text-[18px] font-semibold tracking-[-0.02em] text-ink">That&apos;s part of Pro</SheetTitle>
          <span className="block truncate text-[13px] text-subtle">Pro is coming soon. Join the waitlist.</span>
        </div>
      </div>
      <PlanCards stacked />
    </ResponsiveSheet>
  );
}
