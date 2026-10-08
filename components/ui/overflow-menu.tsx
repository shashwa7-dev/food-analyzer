"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Popover } from "@base-ui/react/popover";
import { Ellipsis } from "lucide-react";
import { cn } from "@/lib/utils";

export type OverflowItem = {
  label: string;
  icon: ReactNode;
  /** A link item, or… */
  href?: string;
  /** …an action; the menu closes first. */
  onSelect?: () => void;
  tone?: "default" | "danger";
};

const ROUND = "grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink transition-colors hover:bg-sunken [&_svg]:size-5";
const ITEM = "flex min-h-11 w-full items-center gap-2.5 rounded-[12px] px-3 text-[14px] font-semibold whitespace-nowrap hover:bg-sunken [&_svg]:size-[18px]";

/**
 * A top bar's round "More actions" button and its menu (mock-c1 `.round` + popover): links and actions,
 * one per row. `triggerClassName` restyles the round button (e.g. ON_MEDIA_ROUND on a photo).
 */
export function OverflowMenu({ items, triggerClassName, label = "More actions" }: { items: OverflowItem[]; triggerClassName?: string; /** The trigger's accessible name. */ label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger aria-label={label} className={cn(ROUND, triggerClassName)}>
        <Ellipsis aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
          <Popover.Popup className="min-w-[188px] origin-(--transform-origin) rounded-[18px] bg-surface p-1.5 text-ink shadow-card outline-none transition-[scale,opacity] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none">
            {items.map((it) => {
              const cls = cn(ITEM, it.tone === "danger" ? "text-bad" : "text-ink");
              const body = (
                <>
                  <span aria-hidden className="contents">{it.icon}</span>
                  {it.label}
                </>
              );
              return it.href ? (
                <Link key={it.label} href={it.href} className={cls} onClick={() => setOpen(false)}>{body}</Link>
              ) : (
                <button
                  key={it.label}
                  type="button"
                  className={cls}
                  onClick={() => {
                    setOpen(false);
                    it.onSelect?.();
                  }}
                >
                  {body}
                </button>
              );
            })}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
