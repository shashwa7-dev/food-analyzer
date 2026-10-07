"use client";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ResponsiveSheet, SheetTitle } from "@/components/ui/responsive-sheet";
import { IconTile } from "@/components/ui/icon-tile";

/**
 * One setting's sheet (spec §6.13): a drawer on phones, a dialog from 900 px. The header repeats the
 * row's icon and label; the body is that setting's section of the settings form.
 */
export function SettingSheet({ open, onOpenChange, icon: Icon, title, hint, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: LucideIcon;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange}>
      <div className="flex items-center gap-3">
        <IconTile tone="brand" size="md"><Icon /></IconTile>
        <div className="min-w-0 flex-1 leading-tight">
          <SheetTitle className="block truncate text-[18px] font-semibold tracking-[-0.02em] text-ink">{title}</SheetTitle>
          <span className="block truncate text-[13px] text-subtle">{hint}</span>
        </div>
      </div>
      {children}
    </ResponsiveSheet>
  );
}
