import Link from "next/link";
import { ChevronRight, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

/** On Progress → Food: a pointer to the Fitness view, where workouts, the weekly goal and weight live. */
export function WorkoutsCard({ className }: { className?: string }) {
  return (
    <Link
      href="/progress?view=fitness"
      className={cn("flex min-h-11 items-center gap-3 rounded-[24px] bg-[color-mix(in_srgb,var(--brand-soft)_50%,var(--surface))] p-3.5 shadow-card md:p-5", className)}
    >
      <Dumbbell className="size-[18px] shrink-0 text-brand-deep" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block whitespace-nowrap text-[15px] font-bold text-ink">Workouts</span>
        <span className="block truncate text-[13.5px] text-subtle">See sessions, your weekly goal and weight in Fitness.</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-subtle" aria-hidden />
    </Link>
  );
}
