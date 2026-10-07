import { cn } from "@/lib/utils";

/** The EATRi8 lockup (mock-c1 `.logo`): "EATR" in ink, "i8" on a lime tab. Size it with a text-* class. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center font-bold tracking-[-0.04em] whitespace-nowrap text-ink", className)}>
      <span className="sr-only">EATRi8</span>
      <span aria-hidden className="contents">
        EATR<span className="ml-[0.1em] rounded-[0.4em] bg-brand px-[0.3em] text-brand-ink">i8</span>
      </span>
    </span>
  );
}
