import type { CSSProperties } from "react";
import { CircleCheck, Star } from "lucide-react";
import { GRADES, type ProgressSummary } from "@/lib/progress/aggregate";
import { gradeTakeaway } from "@/lib/progress/copy";
import { CardNote, ChartCard, LegendList, Takeaway } from "./chart-card";
import { Donut } from "./charts";
import { token } from "./chart-theme";

/** Food quality (spec §6.12): share of graded kcal by grade A–E; ungraded entries are left out. */
export function GradeDonutCard({ mix, className, mountWhen }: { mix: ProgressSummary["gradeMix"]; className?: string; mountWhen?: string }) {
  const takeaway = gradeTakeaway(mix);
  const ab = mix.A + mix.B;
  const label = takeaway
    ? `Food quality: ${GRADES.map((g) => `grade ${g} ${mix[g]}%`).join(", ")} of graded calories.`
    : "Food quality: nothing logged in this range has a grade yet.";
  return (
    <ChartCard icon={Star} title="Food quality" aside={<CardNote>kcal by grade</CardNote>} className={className}>
      <div className="flex items-center gap-5" style={{ "--donut": "104px" } as CSSProperties}>
        <div role="img" aria-label={label}>
          <Donut mountWhen={mountWhen} size={104} thickness={16} center={takeaway ? `${ab}%` : "–"} slices={GRADES.map((g) => ({ name: g, value: mix[g], color: token(`g-${g.toLowerCase()}`) }))} />
        </div>
        <LegendList items={GRADES.map((g) => ({ key: g, label: g, value: `${mix[g]}%`, swatch: token(`g-${g.toLowerCase()}`) }))} />
      </div>
      <Takeaway icon={CircleCheck} tone="good">{takeaway ?? "Grades show up here once you log graded foods."}</Takeaway>
    </ChartCard>
  );
}
