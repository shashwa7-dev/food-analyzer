import { Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

/** Static placeholder until the workout tracker (M4) lands (spec §2, §6.12). */
export function WorkoutsCard({ className }: { className?: string }) {
  return (
    <section
      aria-label="Workouts"
      className={cn("grid content-start gap-2.5 rounded-[24px] bg-[color-mix(in_srgb,var(--brand-soft)_50%,var(--surface))] p-3.5 shadow-card md:p-5", className)}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="m-0 inline-flex items-center gap-[7px] whitespace-nowrap text-[15px] font-bold text-ink">
          <Dumbbell className="size-[18px] shrink-0 text-brand-deep" aria-hidden />
          Workouts
        </h2>
        <span className="whitespace-nowrap rounded-full bg-surface px-[9px] py-1 text-[11.5px] font-[650] uppercase tracking-[0.04em] text-subtle">
          Coming soon
        </span>
      </div>
      <p className="m-0 text-[13.5px] text-subtle">Log workouts and see calories burned next to calories eaten.</p>
    </section>
  );
}
