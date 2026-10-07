import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The dark, full-screen ground the scanner, review tray and Analysing card sit on (spec §6.8–6.10).
 * Fills the phone screen over the app chrome; from 900 px it's a rounded panel beside the sidebar.
 * `data-no-phone-nav` keeps toasts near the bottom edge (globals.css).
 */
export function ScanStage({ className, children, label }: { className?: string; children: ReactNode; label?: string }) {
  return (
    <section
      data-no-phone-nav
      aria-label={label}
      className={cn(
        "fixed inset-0 z-40 isolate flex flex-col overflow-hidden bg-viewfinder pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-on-media",
        "md:relative md:inset-auto md:z-auto md:mx-auto md:h-[calc(100dvh-56px)] md:min-h-[640px] md:w-full md:max-w-[760px] md:rounded-[28px]",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Round 44 px button on the camera (mock-c1 `.scan-top .round`): white, ink icon, in both themes. */
export const ROUND_ON_MEDIA =
  "grid size-11 shrink-0 place-items-center rounded-full bg-on-media text-on-media-ink transition-opacity hover:opacity-90 disabled:opacity-40 [&_svg]:size-5";
