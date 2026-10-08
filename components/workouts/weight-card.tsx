import Link from "next/link";
import { ChevronRight, Scale } from "lucide-react";
import { WeightLine } from "@/components/fitness/weight/charts";
import { fmtChange, fmtWeight, trendPoints } from "@/lib/fitness/weight-view";
import type { WeightHistory } from "@/lib/fitness/types";
import { cn } from "@/lib/utils";

/**
 * The weight card on Progress → Fitness (spec §C screen 6): the latest weight, its 30-day change, and
 * the 30-day trend with the goal line. The whole header links to /weight.
 */
export function WeightCard({ weight, className }: { weight: WeightHistory; className?: string }) {
  const points = trendPoints(weight.entries);
  const change = fmtChange(weight.change30d);
  const goal = weight.goalWeightKg;
  return (
    <section aria-labelledby="fo-weight" className={cn("grid min-w-0 content-start gap-2.5 rounded-[24px] bg-surface px-4 py-3.5 shadow-card md:px-5", className)}>
      <div className="flex min-h-7 items-center justify-between gap-2">
        <h2 id="fo-weight" className="m-0 inline-flex items-center gap-[7px] text-[15px] font-semibold whitespace-nowrap text-ink">
          <Scale className="size-[18px] shrink-0 text-brand-deep" aria-hidden />
          Weight
        </h2>
        <Link href="/weight" className="-my-2 -mr-2 inline-flex min-h-11 shrink-0 items-center gap-[3px] rounded-full px-2 text-[13px] font-semibold whitespace-nowrap text-brand-deep hover:underline hover:underline-offset-4">
          {weight.latest ? "Weight log" : "Log weight"}
          <ChevronRight className="size-[15px]" aria-hidden />
        </Link>
      </div>
      {weight.latest ? (
        <>
          <div className="flex min-w-0 items-baseline gap-2">
            <b className="num text-[28px] leading-none font-[650] tracking-[-0.03em] whitespace-nowrap text-ink">
              {fmtWeight(weight.latest.kg)}
              <small className="ml-1 text-[14px] font-medium tracking-normal text-subtle">kg</small>
            </b>
            <span className="num min-w-0 truncate text-[13px] whitespace-nowrap text-subtle">
              {[change && `${change} in 30 days`, goal !== null && `goal ${fmtWeight(goal)} kg`].filter(Boolean).join(" · ")}
            </span>
          </div>
          {points.length >= 2 && (
            <div className="h-[120px]" role="img" aria-label={`Weight over the last 30 days, from ${fmtWeight(points[0]!.kg)} to ${fmtWeight(points.at(-1)!.kg)} kg${goal !== null ? `, goal ${fmtWeight(goal)} kg` : ""}.`}>
              <WeightLine points={points} goal={goal} />
            </div>
          )}
        </>
      ) : (
        <p className="m-0 truncate text-[13.5px] text-subtle">Log your weight to see the trend.</p>
      )}
    </section>
  );
}
