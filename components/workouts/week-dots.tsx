import { DAY_TYPE_META } from "@/components/workouts/day-type";
import type { WeekDay } from "@/lib/fitness/types";
import { cn } from "@/lib/utils";

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayAbbrev = (date: string) => WEEKDAY_SHORT[new Date(`${date}T00:00:00Z`).getUTCDay()]!;

/** "Tue, Pull day", "Wed, rest", "Fri, to come". */
function dotLabel(d: WeekDay): string {
  const weekday = dayAbbrev(d.date);
  if (d.type) return `${weekday}, ${DAY_TYPE_META[d.type].label} day`;
  return `${weekday}, ${d.state === "future" ? "to come" : "rest"}`;
}

/**
 * Seven dots, Monday–Sunday (workouts-full-v3.html, right column): each coloured by that day's workout
 * type (global constraints "Day-type colours"), outlined for today and faint for days still to come.
 */
export function WeekDots({ days, className }: { days: WeekDay[]; className?: string }) {
  return (
    <section aria-label="This week" className={cn("rounded-[24px] bg-surface p-3.5 shadow-card", className)}>
      <ol className="m-0 grid list-none grid-cols-7 gap-1 p-0">
        {days.map((d) => (
          <li key={d.date} className="grid justify-items-center gap-1.5">
            <span aria-hidden className={cn("text-[12px] font-semibold", d.isToday ? "text-ink" : "text-subtle")}>{d.label}</span>
            <span
              aria-label={dotLabel(d)}
              className={cn(
                "block size-7 rounded-full",
                d.type ? DAY_TYPE_META[d.type].dot : "bg-sunken",
                d.isToday && "ring-2 ring-ink ring-offset-1 ring-offset-surface",
                d.state === "future" && "opacity-40",
              )}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
