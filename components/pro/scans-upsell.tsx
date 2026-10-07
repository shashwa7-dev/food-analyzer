"use client";
import { useState } from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import { PLANS } from "@/lib/credits/plan-features";
import { ProBadge } from "@/components/pro/pro-chip";
import { UpgradeSheet } from "@/components/pro/upgrade-sheet";
import { usePro } from "@/components/pro/pro-context";

/** The "200 scans" line (spec §B), under Me's credit strip: Pro's allowance, locked, opening the upgrade sheet. Gates on and Basic only. */
export function ScansUpsell() {
  const { upsell } = usePro();
  const [open, setOpen] = useState(false);
  if (!upsell) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="-mt-2 flex min-h-[48px] w-full items-center gap-3 rounded-[20px] bg-surface px-4 text-left text-ink shadow-card transition-colors hover:bg-sunken/60 md:-mt-3"
      >
        <Sparkles className="size-5 shrink-0 text-brand-deep" aria-hidden />
        <span className="num min-w-0 truncate text-[14px] font-[550]">{PLANS.pro.aiScansPerMonth} AI scans a month</span>
        <ProBadge className="ml-auto" />
        <ChevronRight className="size-[18px] shrink-0 text-subtle" aria-hidden />
      </button>
      <UpgradeSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
