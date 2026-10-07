import { requireUser } from "@/lib/session";
import { DateSchema, todayIn } from "@/lib/dates";
import { getDay } from "@/lib/log/service";
import type { Meal } from "@/lib/nutrition/types";
import { initialsOf } from "@/lib/initials";
import { dayLabels, headlineFor } from "@/lib/today/headline";
import { DaySummary } from "@/components/today/day-summary";
import { MealSection } from "@/components/today/meal-section";
import { DateSwitcher } from "@/components/today/date-switcher";

// Meal cards follow the day: snacks sit between lunch and dinner (mock-c1).
const DAY_ORDER: Meal[] = ["breakfast", "lunch", "snack", "dinner"];

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { userId, profile, name } = await requireUser();
  const today = todayIn(profile.timezone);
  const requested = (await searchParams).date;
  const date = requested && DateSchema.safeParse(requested).success ? requested : today;
  const day = await getDay(userId, date);
  const labels = dayLabels(date);
  const fullName = name?.trim() || "there";
  const firstName = fullName.split(/\s+/)[0];
  const kcal = day.progress.find((p) => p.key === "energyKcal")!;
  const headline = headlineFor({ eaten: kcal.total, target: kcal.target, isToday: date === today, dateLabel: labels.short });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-start md:gap-[18px]">
      <header className="flex items-center gap-3 md:col-span-2">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft font-bold text-brand-deep">
          {initialsOf(fullName)}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate font-semibold text-ink">Hi, {firstName}</div>
          <div className="truncate text-[13px] text-subtle">{labels.long}</div>
        </div>
        <DateSwitcher date={date} today={today} />
      </header>
      <h1 className="mt-0.5 text-[34px] font-[650] leading-[1.05] tracking-[-0.04em] text-balance text-ink md:col-span-2 md:text-[40px]">
        {headline.lead && <>{headline.lead} </>}
        <em className="num whitespace-nowrap not-italic text-brand-deep">{headline.value}</em> {headline.tail}
      </h1>
      <DaySummary progress={day.progress} />
      <div className="flex flex-col gap-3">
        {DAY_ORDER.map((m) => (
          <MealSection key={m} meal={m} date={date} entries={day.entries.filter((e) => e.meal === m)} kcal={day.byMeal[m].energyKcal} />
        ))}
      </div>
    </div>
  );
}
