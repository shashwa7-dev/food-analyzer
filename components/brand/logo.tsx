import { cn } from "@/lib/utils";

/**
 * The Santul mark, "the split plate": one plate cut into two halves that have slipped past each
 * other. Fixed brand colours in both themes; the hairline keeps the ink tile's edge on a dark page.
 * Size it with a size-* class.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={cn("shrink-0", className)} aria-hidden="true">
      <rect x="0.5" y="0.5" width="119" height="119" rx="28" fill="#12150F" stroke="rgb(255 255 255 / .16)" />
      <g transform="rotate(24 60 60)">
        <path d="M57 23A31 31 0 0 0 57 85Z" fill="#A6D84A" />
        <path d="M63 35A31 31 0 0 1 63 97Z" fill="#EDF1E6" />
      </g>
    </svg>
  );
}

/** The Santul lockup: the mark and the lowercase wordmark. Size it with a text-* class. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-[0.36em] font-bold tracking-[-0.045em] whitespace-nowrap text-ink", className)}>
      <LogoMark className="size-[1.25em]" />
      <span className="sr-only">Santul</span>
      <span aria-hidden>santul</span>
    </span>
  );
}
