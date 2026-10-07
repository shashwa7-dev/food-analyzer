"use client";
import { useId, useState } from "react";
import { Cookie, Flame, Moon, Sun, Sunrise, type LucideIcon } from "lucide-react";
import { AddFoodButton } from "@/components/add-food/add-food-button";
import { EntryRowButton } from "@/components/today/entry-row";
import { IconTile } from "@/components/ui/icon-tile";
import { portionMeta } from "@/lib/log/format";
import { cn } from "@/lib/utils";
import type { Meal } from "@/lib/nutrition/types";
import type { EntryRow } from "@/lib/log/service";

const MEAL: Record<Meal, { label: string; icon: LucideIcon }> = {
  breakfast: { label: "Breakfast", icon: Sunrise },
  lunch: { label: "Lunch", icon: Sun },
  snack: { label: "Snacks", icon: Cookie },
  dinner: { label: "Dinner", icon: Moon },
};

/** "Poha · 1 katori" for a single entry, else the names in order: "Dal, Chapati/Roti, Boiled rice". */
function summary(entries: EntryRow[]): string {
  if (entries.length === 1) return `${entries[0]!.name} · ${portionMeta(entries[0]!.portion)}`;
  return entries.map((e) => e.name).join(", ");
}

/**
 * A Today meal card (spec §6.1): icon tile, name, items summary, kcal chip and a round "+".
 * Tapping the card expands it to the meal's entries, each of which opens the edit sheet.
 * An empty meal is a dashed card with only the "+".
 */
export function MealSection({ meal, date, entries, kcal }: { meal: Meal; date: string; entries: EntryRow[]; kcal: number }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const { label, icon: Icon } = MEAL[meal];
  const empty = entries.length === 0;

  const head = (
    <>
      <IconTile tone="brand" size="md" className="[&_svg]:size-[22px]">
        <Icon />
      </IconTile>
      <span className="block min-w-0 flex-1">
        <span className="block text-base font-semibold leading-snug text-ink">{label}</span>
        <span className="block truncate text-[13px] text-subtle">{empty ? "Nothing logged yet" : summary(entries)}</span>
        {!empty && (
          <span className="num mt-1.5 inline-flex items-center gap-[5px] whitespace-nowrap text-[13px] font-semibold text-ink">
            <Flame className="size-3.5 text-grade-d" aria-hidden />
            {Math.round(kcal).toLocaleString("en-IN")} kcal
          </span>
        )}
      </span>
    </>
  );

  return (
    <section
      aria-label={label}
      className={cn(
        "rounded-[24px]",
        empty ? "border-[1.5px] border-dashed border-line" : "bg-surface shadow-card",
      )}
    >
      <div className={cn("flex items-center gap-3 py-3.5 pr-3.5", empty ? "pl-[14.5px]" : "pl-4")}>
        {empty ? (
          <div className="flex min-w-0 flex-1 items-center gap-3">{head}</div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={listId}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-[14px] text-left"
          >
            {head}
          </button>
        )}
        <AddFoodButton meal={meal} date={date} label={label} />
      </div>
      {!empty && (
        <div id={listId} hidden={!open} className="divide-y divide-line border-t border-line">
          {entries.map((entry) => <EntryRowButton key={entry.id} entry={entry} />)}
        </div>
      )}
    </section>
  );
}
