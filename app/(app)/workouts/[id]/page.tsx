import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Flame } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getWorkout } from "@/lib/fitness/service";
import { exerciseSummary, workoutWhen } from "@/lib/fitness/summary";
import { grouped } from "@/lib/progress/copy";
import type { Intensity } from "@/lib/fitness/types";
import { WorkoutTopBar } from "@/components/fitness/workout-actions";

const INTENSITY_LABEL: Record<Intensity, string> = { easy: "Easy", moderate: "Moderate", hard: "Hard" };

/**
 * A saved workout (spec §C screen 3, mock-c1 Fitness "Finished"): the done tick, title and time range,
 * stat tiles (min · sets · kg volume · kcal for a gym session; min · intensity · kcal for an activity),
 * each exercise's done sets with PR badges, and how the burn was estimated.
 */
export default async function WorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId, profile } = await requireUser();
  const w = await getWorkout(userId, (await params).id);
  if (!w) notFound();
  const gym = w.kind === "gym";
  const kcal = `${w.kcalEstimated ? "~" : ""}${grouped(w.kcalBurned)}`;
  const stats: { value: string; label: string }[] = gym
    ? [{ value: String(w.durationMin), label: "min" }, { value: String(w.setCount), label: "sets" }, { value: grouped(w.volumeKg), label: "kg volume" }, { value: kcal, label: "kcal" }]
    : [{ value: String(w.durationMin), label: "min" }, { value: INTENSITY_LABEL[w.intensity], label: "intensity" }, { value: kcal, label: "kcal" }];

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-3">
      <WorkoutTopBar workout={w} />

      <div className="grid justify-items-center gap-1 pt-2.5 pb-1 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-brand text-brand-ink [&_svg]:size-7">
          <Check aria-hidden />
        </span>
        <h1 className="m-0 mt-1 max-w-full truncate text-[24px] leading-tight font-semibold tracking-[-0.03em] whitespace-nowrap text-ink">{w.title}</h1>
        <p className="num m-0 text-[14px] whitespace-nowrap text-subtle">{workoutWhen(w.startedAt, w.durationMin, profile.timezone)}</p>
      </div>

      <dl className={`num m-0 grid gap-1.5 ${gym ? "grid-cols-4" : "grid-cols-3"}`}>
        {stats.map((s) => (
          <div key={s.label} className="grid min-w-0 rounded-[14px] bg-surface px-0.5 py-2.5 text-center shadow-card">
            <dt className="row-start-2 truncate text-[11.5px] whitespace-nowrap text-subtle">{s.label}</dt>
            <dd className="row-start-1 m-0 truncate text-[17px] font-semibold tracking-[-0.02em] whitespace-nowrap text-ink">{s.value}</dd>
          </div>
        ))}
      </dl>

      {gym && w.exercises.length > 0 && (
        <section aria-label="Exercises" className="rounded-[20px] bg-surface px-3.5 py-1.5 shadow-card">
          <ul className="m-0 list-none p-0">
            {w.exercises.map((e) => (
              <li key={e.position} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 border-t border-line py-[9px] first:border-t-0">
                <span className="truncate text-[14px] font-semibold whitespace-nowrap text-ink">{e.name}</span>
                <span className="num col-start-1 truncate text-[12.5px] whitespace-nowrap text-subtle">{exerciseSummary(e)}</span>
                {e.pr && (
                  <span className="col-start-2 row-span-2 row-start-1 rounded-full bg-brand px-2 py-1 text-[11px] font-[750] whitespace-nowrap text-brand-ink">
                    PR<span className="sr-only">: a personal record</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="m-0 flex flex-wrap items-center gap-x-1 px-1 text-[12.5px] leading-snug text-subtle [&_svg]:size-3.5">
        <span>
          <Flame className="mr-1 inline-block align-[-2px] text-grade-d" aria-hidden />
          Calories burned is an estimate from duration and your weight ({w.kcalBasis.weightKg} kg).
        </span>
        {w.kcalBasis.estimated && (
          <span className="inline-flex items-center gap-1">
            <span aria-hidden>·</span>
            <Link href="/weight" className="inline-flex min-h-11 items-center font-semibold whitespace-nowrap text-ink underline underline-offset-3">
              Log your weight for a better estimate
            </Link>
          </span>
        )}
      </p>
    </div>
  );
}
