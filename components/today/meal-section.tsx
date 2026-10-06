import Link from "next/link";
import { GradeBadge } from "@/components/grade-badge";
import { AddFoodButton } from "@/components/add-food/add-food-button";
import type { Meal } from "@/lib/nutrition/types";
import type { EntryRow } from "@/lib/log/service";

function portionMeta(entry: EntryRow): string {
  const { portion } = entry;
  if (portion.unit === "g" || portion.unit === "ml") return `${portion.amount} ${portion.unit}`;
  return portion.amount === 1 ? portion.label : `${portion.amount} × ${portion.label}`;
}

export function MealSection({ meal, date, entries, kcal }: { meal: Meal; date: string; entries: EntryRow[]; kcal: number }) {
  return (
    <section aria-label={meal} className="overflow-hidden rounded-[18px] border border-line bg-surface shadow-card">
      <div className="flex items-center justify-between px-5 pb-3 pt-4">
        <h2 className="section-title capitalize">{meal}</h2>
        {entries.length > 0 && <span className="num text-sm text-subtle">{Math.round(kcal)} kcal</span>}
      </div>
      {entries.map((entry) => {
        const content = (
          <>
            <GradeBadge grade={entry.grade} size="sm" />
            <span className="min-w-0 flex-1">
              <div className="font-medium">{entry.name}</div>
              <div className="text-sm text-subtle">{portionMeta(entry)}</div>
            </span>
            <span className="num shrink-0 font-semibold">{Math.round(entry.nutrients.energyKcal)}</span>
          </>
        );
        return entry.foodId ? (
          <Link key={entry.id} href={`/foods/${entry.foodId}`} className="flex min-h-14 w-full items-center gap-3.5 border-t border-line px-5 py-3 text-left">
            {content}
          </Link>
        ) : (
          <div key={entry.id} className="flex min-h-14 w-full items-center gap-3.5 border-t border-line px-5 py-3 text-left">
            {content}
          </div>
        );
      })}
      <AddFoodButton meal={meal} date={date} />
    </section>
  );
}
