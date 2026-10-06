import { requireUser } from "@/lib/session";
import { addDays, DateSchema, todayIn } from "@/lib/dates";
import { getDay } from "@/lib/log/service";
import { MEALS } from "@/lib/nutrition/types";
import { DaySummary } from "@/components/today/day-summary";
import { MealSection } from "@/components/today/meal-section";
import { DateSwitcher } from "@/components/today/date-switcher";

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { userId, profile } = await requireUser();
  const today = todayIn(profile.timezone);
  const requested = (await searchParams).date;
  const date = requested && DateSchema.safeParse(requested).success ? requested : today;
  const day = await getDay(userId, date);
  const label = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
  const [weekday, ...rest] = label.split(" ");
  return (
    <div className="flex flex-col gap-4">
      <header className="mb-2 flex items-center justify-between gap-3">
        <div><div className="text-sm text-subtle">{date === today ? "Today" : weekday?.replace(",", "")}</div><h1 className="title text-[30px] md:text-[34px]">{rest.join(" ")}</h1></div>
        <DateSwitcher date={date} prev={addDays(date, -1)} next={date < today ? addDays(date, 1) : null} today={today} />
      </header>
      <DaySummary progress={day.progress} />
      {MEALS.map((m) => <MealSection key={m} meal={m} date={date} entries={day.entries.filter((e) => e.meal === m)} kcal={day.byMeal[m].energyKcal} />)}
    </div>
  );
}
