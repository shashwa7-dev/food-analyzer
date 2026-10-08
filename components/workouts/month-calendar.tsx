import type { MonthCalendar as MonthCalendarData } from "@/lib/fitness/insights";
import { DAY_TYPES } from "@/lib/fitness/insights";
import { DAY_TYPE_META } from "@/components/workouts/day-type";
import { dayMonth, weekdayShort } from "@/lib/progress/copy";
import { cn } from "@/lib/utils";

const WEEKDAY_HEADERS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * The month grid inside TrendsCard's Calendar tab (chart-stack-or-switch-v2.html `.cal`): Monday-first,
 * `leadingBlanks` empty cells then one rounded square per day, coloured by `DAY_TYPE_META[type].dot`
 * (rest days `bg-sunken`, future days the same at 50% opacity, today ringed). A legend in `DAY_TYPES`
 * order always sits underneath (global constraints).
 */
export function MonthCalendar({ calendar, className }: { calendar: MonthCalendarData; className?: string }) {
  const types = DAY_TYPES.filter((t) => calendar.days.some((d) => d.type === t));
  return (
    <div className={cn("grid min-w-0 gap-2.5", className)}>
      <p className="m-0 text-[12.5px] whitespace-nowrap text-subtle">{calendar.workoutDays} workout days</p>
      <div role="grid" aria-label="Calendar" className="grid grid-cols-7 gap-1.5">
        {WEEKDAY_HEADERS.map((h, i) => (
          <span key={i} aria-hidden className="text-center text-[10.5px] font-semibold text-subtle">
            {h}
          </span>
        ))}
        {Array.from({ length: calendar.leadingBlanks }, (_, i) => (
          <span key={`b${i}`} aria-hidden />
        ))}
        {calendar.days.map((d) => {
          const meta = d.type ? DAY_TYPE_META[d.type] : null;
          return (
            <div
              key={d.date}
              role="gridcell"
              aria-label={`${weekdayShort(d.date)} ${dayMonth(d.date)}, ${meta ? `${meta.label} day` : "rest"}`}
              className={cn(
                "h-[30px] rounded-[7px] md:h-[34px]",
                meta ? meta.dot : "bg-sunken",
                d.isFuture && "opacity-50",
                d.isToday && "ring-2 ring-ink",
              )}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-subtle">
        {types.map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <i aria-hidden className={cn("size-[9px] rounded-[3px]", DAY_TYPE_META[t].dot)} />
            {DAY_TYPE_META[t].label}
          </span>
        ))}
      </div>
    </div>
  );
}
