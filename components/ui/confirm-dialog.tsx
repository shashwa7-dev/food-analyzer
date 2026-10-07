"use client";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";

/**
 * Centred confirmation (spec §6.6): an icon tile, a title, one honest sentence about the
 * consequence, then "Keep it" and the action. Used for deleting an entry, a scan and the account;
 * `children` holds anything extra the action needs (account deletion's type-DELETE field), and
 * `confirmDisabled` lets the caller gate the action on it.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  icon,
  title,
  body,
  confirmLabel,
  confirmIcon,
  tone = "danger",
  onConfirm,
  pending = false,
  pendingLabel,
  confirmDisabled = false,
  cancelLabel = "Keep it",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: ReactNode;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  /** Shown before the label on the action button; defaults to `icon`. */
  confirmIcon?: ReactNode;
  tone?: "danger";
  onConfirm: () => void;
  pending?: boolean;
  pendingLabel?: string;
  confirmDisabled?: boolean;
  cancelLabel?: string;
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!pending) onOpenChange(next); }}>
      <DialogContent
        showCloseButton={false}
        // A confirmation usually sits on top of a sheet: render the backdrop even when nested (Base
        // UI skips it by default) and dim harder than a plain dialog (mock .dim).
        overlayProps={{ forceRender: true, className: "bg-black/40" }}
        className="max-w-[calc(100%-40px)] justify-items-center gap-2.5 p-[22px] text-center shadow-[0_30px_60px_rgb(0_0_0/.3)] ring-0 sm:max-w-[360px]"
      >
        <IconTile tone={tone === "danger" ? "bad" : "neutral"} className="size-[54px] rounded-[18px] [&_svg]:size-[26px]">
          {icon}
        </IconTile>
        <DialogTitle className="text-[19px] font-semibold leading-tight tracking-[-0.02em] text-ink">{title}</DialogTitle>
        <DialogDescription className="mb-1.5 text-[14px] leading-[1.45] text-pretty text-subtle">{body}</DialogDescription>
        {children}
        <div className="grid w-full grid-cols-2 gap-2.5">
          <Button type="button" variant="ghost-sunken" shape="pill" size="xl" className="h-[54px] min-w-0 px-4" disabled={pending} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            shape="pill"
            size="xl"
            className="h-[54px] min-w-0 px-4"
            disabled={pending || confirmDisabled}
            onClick={onConfirm}
          >
            {pending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <span aria-hidden className="contents">{confirmIcon ?? icon}</span>}
            {pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
