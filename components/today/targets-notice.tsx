"use client";
import { useState, useTransition } from "react";
import { Target, X } from "lucide-react";
import { toast } from "sonner";
import { IconTile } from "@/components/ui/icon-tile";
import { Button } from "@/components/ui/button";
import { UpgradeSheet } from "@/components/pro/upgrade-sheet";
import { dismissNoticeAction } from "@/app/(app)/me/actions";

/**
 * The one-time targets-reset notice on Today and Me (spec §B): shown while the gates are enforced to a
 * Basic user whose custom targets are now ignored (showTargetsNotice). Dismissing records
 * notices.targetsReset, so it never shows again; it hides at once and comes back only if that fails.
 */
export function TargetsNotice() {
  const [hidden, setHidden] = useState(false);
  const [upgrade, setUpgrade] = useState(false);
  const [, startTransition] = useTransition();
  if (hidden) return null;

  function dismiss() {
    setHidden(true);
    startTransition(async () => {
      try {
        await dismissNoticeAction("targetsReset");
      } catch {
        setHidden(false);
        toast.error("Couldn't save that. Try again.");
      }
    });
  }

  return (
    <section aria-label="Targets notice" className="flex items-start gap-3 rounded-[20px] bg-surface py-3 pr-1.5 pl-3.5 shadow-card">
      <IconTile tone="brand" size="sm" className="mt-0.5"><Target aria-hidden /></IconTile>
      <div className="grid min-w-0 flex-1 gap-2 pt-0.5">
        <p className="m-0 text-[14px] leading-snug text-ink">
          Custom targets are now part of Pro. You&apos;re on your goal&apos;s preset targets.
        </p>
        <Button type="button" variant="ghost-sunken" shape="pill" size="lg" className="h-11 self-start px-4 text-[14px]" onClick={() => setUpgrade(true)} aria-haspopup="dialog">
          See Pro
        </Button>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="grid size-11 shrink-0 place-items-center rounded-full text-subtle hover:bg-sunken hover:text-ink"
      >
        <X className="size-[18px]" aria-hidden />
      </button>
      <UpgradeSheet open={upgrade} onOpenChange={setUpgrade} />
    </section>
  );
}
