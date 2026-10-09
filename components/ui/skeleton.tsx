import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/brand/logo";

/**
 * Loading placeholders. Each route's loading.tsx lays these out like the page it stands in for, so
 * the content lands where the grey already was. Next shows it the moment a link is tapped.
 */

/** A page-shaped skeleton, announced once as "Loading". The bones pulse in step; the cards hold still. */
export function SkeletonPage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={cn("flex flex-col gap-3.5 md:gap-5", className)}>
      <span className="sr-only">Loading</span>
      {children}
    </div>
  );
}

/** A grey block where text or a control will be. Give it a size (and a radius, if not a text line). */
export function Bone({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-full bg-ink/10 motion-reduce:animate-none", className)} />;
}

/** A card outline like the real ones (surface, hairline), holding bones. */
export function SkeletonCard({ children, className }: { children?: ReactNode; className?: string }) {
  return <div className={cn("rounded-[24px] bg-surface p-4 shadow-card", className)}>{children}</div>;
}

/** A list row: an icon tile, two lines and a trailing mark. */
export function SkeletonRow({ className, trailing = "size-5" }: { className?: string; trailing?: string | null }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Bone className="size-11 shrink-0 rounded-[14px]" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Bone className="h-3.5 w-2/5" />
        <Bone className="h-3 w-3/5" />
      </div>
      {trailing ? <Bone className={cn("shrink-0", trailing)} /> : null}
    </div>
  );
}

/** A page title with the Week | Month style switch some pages have on the right. */
export function SkeletonTitle({ withSwitch = false, className }: { withSwitch?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 pt-1", className)}>
      <Bone className="h-8 w-36 rounded-[10px]" />
      {withSwitch ? <Bone className="h-10 w-[132px]" /> : null}
    </div>
  );
}

/** The top bar of a sub-page: a round Back button and a centred title. */
export function SkeletonTopBar() {
  return (
    <div className="flex items-center justify-between gap-3">
      <Bone className="size-11" />
      <Bone className="h-4 w-28" />
      <span className="size-11" aria-hidden="true" />
    </div>
  );
}

/**
 * The logo as a loader: the plate's two halves slide along the cut and back. For pages with no
 * fixed shape to sketch (one food, one scan, a form), where a skeleton would only guess.
 */
export function BrandLoader({ className }: { className?: string }) {
  return (
    <div role="status" aria-busy="true" className={cn("flex min-h-[60dvh] flex-col items-center justify-center", className)}>
      <LogoMark animated className="size-14" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
