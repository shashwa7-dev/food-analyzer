import { AddFoodButton } from "@/components/add-food/add-food-button";
import { EntryRowButton } from "@/components/today/entry-row";
import type { Meal } from "@/lib/nutrition/types";
import type { EntryRow } from "@/lib/log/service";

export function MealSection({ meal, date, entries, kcal }: { meal: Meal; date: string; entries: EntryRow[]; kcal: number }) {
  return (
    <section aria-label={meal} className="overflow-hidden rounded-[18px] border border-line bg-surface shadow-card">
      <div className="flex items-center justify-between px-5 pb-3 pt-4">
        <h2 className="section-title capitalize">{meal}</h2>
        {entries.length > 0 && <span className="num text-sm text-subtle">{Math.round(kcal)} kcal</span>}
      </div>
      {entries.map((entry) => <EntryRowButton key={entry.id} entry={entry} />)}
      <AddFoodButton meal={meal} date={date} />
    </section>
  );
}
