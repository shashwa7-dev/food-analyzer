import Link from "next/link";
import { CalendarDays, Check, ChevronRight, Dumbbell, History, Plus } from "lucide-react";
import { IconTile } from "@/components/ui/icon-tile";
import { WorkoutRow, workoutMeta } from "@/components/fitness/workout-row";
import { WeightCard } from "@/components/workouts/weight-card";
import type { FitnessSummary, WeekDay, WeightHistory } from "@/lib/fitness/types";
import { dayMonth } from "@/lib/progress/copy";
import { addDays } from "@/lib/dates";
import { cn } from "@/lib/utils";

const CARD = "rounded-[24px] bg-surface shadow-card";
const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dayName = (d: WeekDay) => WEEKDAY_LONG[new Date(`${d.date}T00:00:00Z`).getUTCDay()]!;

/** "2h 50m", "45m", "0m". */
export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

const STATE_TEXT: Record<WeekDay["state"], string> = { done: "trained", rest: "rest day", today: "today", future: "to come" };

/** The week strip (mock-c1 `.fo-week`): seven days, each done, rest, today or still to come. */
function WeekStrip({ week }: { week: FitnessSummary["week"] }) {
  return (
    <section aria-labelledby="fo-week" className={cn(CARD, "grid gap-3 p-3.5 md:col-span-2 md:p-5")}>
      <div className="flex min-h-7 items-center justify-between gap-2">
        <h2 id="fo-week" className="m-0 inline-flex items-center gap-[7px] text-[15px] font-semibold whitespace-nowrap text-ink">
          <CalendarDays className="size-[18px] shrink-0 text-brand-deep" aria-hidden />
          This week
        </h2>
        <span className="num truncate text-[12.5px] whitespace-nowrap text-subtle">Goal {week.goal.target} workout days</span>
      </div>
      <ol className="m-0 grid list-none grid-cols-7 gap-1 p-0">
        {week.days.map((d) => (
          <li key={d.date} className="grid justify-items-center gap-1.5" aria-label={`${dayName(d)}, ${d.isToday && d.state === "done" ? "today, trained" : STATE_TEXT[d.state]}`}>
            <span aria-hidden className={cn("text-[12px] font-semibold", d.isToday ? "text-ink" : "text-subtle")}>{d.label}</span>
            <span
              aria-hidden
              className={cn(
                "grid size-9 place-items-center rounded-full [&_svg]:size-[17px]",
                d.state === "done" && "bg-brand-soft text-brand-deep",
                d.state === "today" && "bg-brand text-brand-ink",
                d.state === "rest" && "border-[1.5px] border-dashed border-line",
                d.state === "future" && "bg-sunken",
                d.isToday && "ring-[3px] ring-brand/30",
              )}
            >
              {d.state === "done" ? <Check /> : d.state === "today" ? <Dumbbell /> : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * The dark weekly goal card (mock-c1 `.fo-goal`): "3 of 5" workout days, with one dot per day. Dark in
 * both themes (the media tokens don't switch), so the lime dots keep their contrast.
 */
function GoalCard({ goal }: { goal: FitnessSummary["week"]["goal"] }) {
  const left = Math.max(0, goal.target - goal.done);
  return (
    <section aria-label="Weekly goal" className="flex items-center justify-between gap-3 rounded-[24px] bg-viewfinder p-[18px] text-on-media shadow-card">
      <div className="min-w-0">
        <span className="block text-[12px] font-semibold tracking-[0.06em] whitespace-nowrap uppercase opacity-70">Weekly goal</span>
        <b className="num mt-1.5 block text-[34px] leading-none font-[650] tracking-[-0.04em] whitespace-nowrap">
          {goal.done} of {goal.target}
        </b>
        <span className="mt-1 block truncate text-[13px] whitespace-nowrap opacity-70">
          workout days · {goal.met ? "goal met" : `${left} to go`}
        </span>
      </div>
      <div aria-hidden className="grid shrink-0 grid-cols-[repeat(4,18px)] gap-1.5">
        {Array.from({ length: goal.target }, (_, i) => (
          <i key={i} className={cn("block size-[18px] rounded-full border-[1.5px] border-brand", i < goal.done && "bg-brand")} />
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <section aria-label={label} className={cn(CARD, "grid min-w-0 gap-0.5 p-3.5")}>
      <span className="text-[12px] font-semibold tracking-[0.06em] whitespace-nowrap text-subtle uppercase">{label}</span>
      <b className="num truncate text-[26px] leading-tight font-[650] tracking-[-0.03em] whitespace-nowrap text-ink">{value}</b>
      <span className="truncate text-[12px] whitespace-nowrap text-subtle">{sub}</span>
    </section>
  );
}

const sectionHead = "m-0 inline-flex items-center gap-[7px] text-[15px] font-semibold whitespace-nowrap text-ink";
const headLink = "-my-2 -mr-2 inline-flex min-h-11 shrink-0 items-center gap-[3px] rounded-full px-2 text-[13px] font-semibold whitespace-nowrap text-brand-deep hover:underline hover:underline-offset-4";

/** Up next (mock-c1 `.fo-next`): the next preset in the rotation, with Start. */
function UpNextCard({ next }: { next: FitnessSummary["upNext"] }) {
  return (
    <section aria-labelledby="fo-next" className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-2">
      <div className="flex min-h-7 items-center justify-between gap-2 px-0.5">
        <h2 id="fo-next" className={sectionHead}>Up next</h2>
        <Link href="/workouts/new" className={headLink}>
          All presets
          <ChevronRight className="size-[15px]" aria-hidden />
        </Link>
      </div>
      <Link href={`/workouts/session?preset=${next.preset}`} className={cn(CARD, "flex min-h-[68px] items-center gap-3 px-3.5 py-3 text-ink")}>
        <IconTile tone="protein"><Dumbbell /></IconTile>
        <span className="min-w-0 flex-1 leading-tight">
          <b className="block truncate text-[15px] font-semibold whitespace-nowrap">{next.title}</b>
          <span className="block truncate text-[13px] whitespace-nowrap text-subtle">{next.muscles} · {next.exerciseCount} exercises</span>
        </span>
        <span className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-action px-4 text-[14px] font-semibold whitespace-nowrap text-action-ink">Start</span>
      </Link>
    </section>
  );
}

/** Recent workouts: the last five, each linking to its summary. */
function RecentCard({ recent, today }: { recent: FitnessSummary["recent"]; today: string }) {
  const when = (date: string) => (date === today ? "Today" : date === addDays(today, -1) ? "Yesterday" : dayMonth(date));
  return (
    <section aria-labelledby="fo-recent" className={cn(CARD, "grid min-w-0 content-start gap-1.5 px-4 py-3.5 md:col-span-2 md:px-5")}>
      <div className="flex min-h-7 items-center justify-between gap-2">
        <h2 id="fo-recent" className={sectionHead}>
          <History className="size-[18px] shrink-0 text-brand-deep" aria-hidden />
          Recent workouts
        </h2>
        <Link href="/workouts/new" className={headLink}>
          <Plus className="size-[15px]" aria-hidden />
          Log<span className="sr-only"> a workout</span>
        </Link>
      </div>
      {recent.length === 0 ? (
        <p className="m-0 truncate text-[13.5px] text-subtle">No workouts yet. Log one to see it here.</p>
      ) : (
        <ul className="m-0 grid list-none gap-0.5 p-0">
          {recent.map((w) => (
            <li key={w.id}>
              <WorkoutRow w={w} meta={`${when(w.date)} · ${workoutMeta(w)}`} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Progress → Fitness (spec §C screen 6, mock-c1 Fitness 0). Week-only: the range toggle is hidden. */
export function FitnessView({ summary, weight }: { summary: FitnessSummary; weight: WeightHistory }) {
  const { week } = summary;
  return (
    <>
      <WeekStrip week={week} />
      <GoalCard goal={week.goal} />
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <Stat label="Time" value={fmtDuration(week.minutes)} sub="this week" />
        <Stat label="Burned" value={`${week.kcalEstimated ? "~" : ""}${Math.round(week.kcal).toLocaleString("en-IN")}`} sub="kcal this week" />
      </div>
      <UpNextCard next={summary.upNext} />
      <WeightCard weight={weight} />
      <RecentCard recent={summary.recent} today={summary.today} />
    </>
  );
}
