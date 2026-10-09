import { requireUser } from "@/lib/session";
import { DateSchema, todayIn } from "@/lib/dates";
import { getDay } from "@/lib/log/service";
import { getProgress } from "@/lib/progress/service";
import { listScans } from "@/lib/scans/service";
import type { Meal } from "@/lib/nutrition/types";
import { initialsOf } from "@/lib/initials";
import { dayLabels, headlineFor } from "@/lib/today/headline";
import { toneFor } from "@/lib/today/tone";
import { cn } from "@/lib/utils";
import { DaySummary } from "@/components/today/day-summary";
import { MealSection } from "@/components/today/meal-section";
import { DateSwitcher } from "@/components/today/date-switcher";
import { DailyLimitsCard } from "@/components/today/daily-limits-card";
import { WeekCard } from "@/components/today/week-card";
import { RecentScansCard } from "@/components/today/recent-scans-card";
import { TargetsNotice } from "@/components/today/targets-notice";
import { showTargetsNotice } from "@/lib/profile/effective-targets";
import { listWorkouts } from "@/lib/fitness/service";
import { burnedSuffix, energyLine } from "@/lib/today/energy";
import { EnergyStrip } from "@/components/today/energy-strip";
import { WorkoutsCard } from "@/components/today/workouts-card";
import { ResumeBanner } from "@/components/fitness/resume-banner";

export const metadata = { title: "Today" };

// Meal cards follow the day: snacks sit between lunch and dinner (mock-c1).
const DAY_ORDER = ["breakfast", "lunch", "snack", "dinner"] as const satisfies Meal[];

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { userId, profile, name } = await requireUser();
  const today = todayIn(profile.timezone);
  const requested = (await searchParams).date;
  const date = requested && DateSchema.safeParse(requested).success ? requested : today;
  // The rail's week and scans don't follow the picked date: they are always the last 7 days and the
  // latest scans. Read on phones too (the server can't know the width); the rail is hidden there.
  const [day, week, recent, workouts] = await Promise.all([
    getDay(userId, date),
    getProgress(userId, "week"),
    listScans(userId, {}, undefined, 3),
    listWorkouts(userId, { from: date, to: date }),
  ]);
  const labels = dayLabels(date);
  const fullName = name?.trim() || "there";
  const firstName = fullName.split(/\s+/)[0];
  const kcal = day.progress.find((p) => p.key === "energyKcal")!;
  const headline = headlineFor({ eaten: kcal.total, target: kcal.target, isToday: date === today, dateLabel: labels.short });
  // Workouts are shown beside the food, never subtracted from the target (spec §C: no eat-back).
  const burned = workouts.reduce((sum, w) => sum + w.kcalBurned, 0);
  const energy = workouts.length ? energyLine(kcal.total, burned, kcal.target) : null;

  return (
    // Day + insights rail (mock-c1 "Today on desktop", option A). One column on phones. Workouts now sits
    // in the main column, under the meals, on every width (spec: the hub lives at /workouts). From 900 px
    // the rail's remaining cards show, under the day while the content area is narrow (a 300 px rail
    // beside it would leave the day ~270 px at 900 px), and as a 300 px column beside it once the area is
    // 840 px wide.
    <div className="@container">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 md:gap-6 @min-[840px]:grid-cols-[minmax(0,1fr)_300px] @min-[840px]:items-start">
        <div className="flex min-w-0 flex-col gap-3.5 md:gap-5">
          <header className="flex items-center gap-3">
            <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft font-bold text-on-brand-soft">
              {initialsOf(fullName)}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate font-semibold text-ink">Hi, {firstName}</div>
              <div className="truncate text-[13px] text-subtle">{labels.long}</div>
            </div>
            <DateSwitcher date={date} today={today} />
          </header>
          <h1 className="mt-0.5 text-[28px] font-[650] leading-[1.08] tracking-[-0.04em] text-balance text-ink md:text-[40px]">
            {headline.lead && <>{headline.lead} </>}
            <em className={cn("num whitespace-nowrap not-italic", toneFor(kcal.total, kcal.target) === "over" ? "text-bad" : "text-brand-deep")}>{headline.value}</em> {headline.tail}
            {energy && <span className="num text-[0.6em] font-semibold tracking-[-0.02em] whitespace-nowrap text-subtle"> {burnedSuffix(energy.burned)}</span>}
          </h1>
          <ResumeBanner userId={userId} />
          {showTargetsNotice(profile) && <TargetsNotice />}
          <DaySummary progress={day.progress} />
          {energy && <EnergyStrip line={energy} />}
          <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-4">
            {DAY_ORDER.map((m, i) => (
              <MealSection key={m} meal={m} index={i as 0 | 1 | 2 | 3} date={date} entries={day.entries.filter((e) => e.meal === m)} kcal={day.byMeal[m].energyKcal} />
            ))}
          </div>
          <WorkoutsCard workouts={workouts} isToday={date === today} />
        </div>
        <aside aria-label="Insights" className="hidden min-w-0 gap-3.5 md:grid md:gap-5 md:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] md:items-start @min-[840px]:grid-cols-1">
          <DailyLimitsCard progress={day.progress} />
          <WeekCard week={week} goal={profile.goal} />
          <RecentScansCard scans={recent.scans} />
        </aside>
      </div>
    </div>
  );
}
