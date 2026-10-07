"use client";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";

/**
 * Centred confirmation (spec §6.6), a Base UI AlertDialog (role="alertdialog"): an icon tile, a title, one honest sentence about the
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
  /** Every confirmation so far is destructive; the only tone is the red one. */
  tone?: "danger";
  onConfirm: () => void;
  pending?: boolean;
  pendingLabel?: string;
  confirmDisabled?: boolean;
  cancelLabel?: string;
  children?: ReactNode;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => { if (!pending) onOpenChange(next); }}>
      <AlertDialog.Portal>
        {/* A confirmation usually sits on top of a sheet: render the backdrop even when nested (Base
            UI skips it by default) and dim harder than a plain dialog (mock .dim). */}
        <AlertDialog.Backdrop
          forceRender
          className="fixed inset-0 isolate z-50 bg-black/40 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-40px)] -translate-x-1/2 -translate-y-1/2 justify-items-center gap-2.5 rounded-[28px] bg-bg p-[22px] text-center text-ink shadow-[0_30px_60px_rgb(0_0_0/.3)] outline-none! duration-100 sm:max-w-[360px] data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          <IconTile tone="bad" className="size-[54px] rounded-[18px] [&_svg]:size-[26px]">
            {icon}
          </IconTile>
          <AlertDialog.Title className="m-0 text-[19px] font-semibold leading-tight tracking-[-0.02em] text-ink">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mb-1.5 text-[14px] leading-[1.45] text-pretty text-subtle">{body}</AlertDialog.Description>
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
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
