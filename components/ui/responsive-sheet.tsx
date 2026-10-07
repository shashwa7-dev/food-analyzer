"use client";
import { createContext, useContext, useRef, type ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useMediaQuery } from "@/lib/hooks/use-media-query";

const DesktopContext = createContext(false);

/**
 * A bottom sheet on phones and a centred dialog from 900 px (mock-c1 `.sheet`: --bg, 30 px top
 * radius, 18 px sides, 14 px between rows). Put a `SheetTitle` inside to name it.
 */
export function ResponsiveSheet({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  const isDesktop = useMediaQuery("(min-width: 900px)");
  // Focus the sheet itself on open, not its first button (the edit sheet's first is Delete).
  const popup = useRef<HTMLDivElement>(null);
  if (isDesktop) {
    return (
      <DesktopContext.Provider value>
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent ref={popup} initialFocus={popup} showCloseButton={false} className="max-h-[85vh] gap-3.5 overflow-y-auto p-[22px] sm:max-w-[420px]">
            {children}
          </DialogContent>
        </Dialog>
      </DesktopContext.Provider>
    );
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      <DrawerContent ref={popup} initialFocus={popup} className="shadow-[0_-10px_30px_rgb(0_0_0/.18)]">
        <div className="flex flex-col gap-3.5 overflow-y-auto px-[18px] pt-2.5 pb-[calc(22px+env(safe-area-inset-bottom))]">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}

/** The sheet's accessible name: the Drawer's or the Dialog's title, whichever is showing. */
export function SheetTitle({ className, children }: { className?: string; children: ReactNode }) {
  const Title = useContext(DesktopContext) ? DialogTitle : DrawerTitle;
  return <Title className={className}>{children}</Title>;
}
