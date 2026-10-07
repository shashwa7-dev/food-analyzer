"use client";
import { useId, useState } from "react";
import { Flame } from "lucide-react";
import { AddFoodButton } from "@/components/add-food/add-food-button";
import { MEAL_META } from "@/components/food/meal-meta";
import { EntryRowButton } from "@/components/today/entry-row";
import { IconTile } from "@/components/ui/icon-tile";
import { portionMeta } from "@/lib/log/format";
import { cn } from "@/lib/utils";
import type { Meal } from "@/lib/nutrition/types";
import type { EntryRow } from "@/lib/log/service";

/** "Poha · 1 katori" for a single entry, else the names in order: "Dal, Chapati/Roti, Boiled rice". */
function summary(entries: EntryRow[]): string {
  if (entries.length === 1) return `${entries[0]!.name} · ${portionMeta(entries[0]!.portion)}`;
  return entries.map((e) => e.name).join(", ");
}

// From 900 px the cards sit in a 2×2 grid and an expanded meal's entries open as a full-width row
// under its pair. The wrapper is `display: contents` there, so the card and its entries are grid
// items placed by `order`: cards 1, 2 | entries 3, 4 | cards 5, 6 | entries 7, 8. Literal classes so
// Tailwind sees them.
const CARD_ORDER = ["md:order-1", "md:order-2", "md:order-5", "md:order-6"] as const;
const LIST_ORDER = ["md:order-3", "md:order-4", "md:order-7", "md:order-8"] as const;
// The card's box: on the wrapper on phones (it holds the entries too), on the card itself from 900 px.
// A filled card gets a transparent border as wide as the empty card's dashed one, so both measure the same.
const BOX = {
  empty: "border-[1.5px] border-dashed border-line",
  filled: "border-[1.5px] border-transparent bg-surface shadow-card",
} as const;
const MD_BOX = {
  empty: "md:rounded-[24px] md:border-[1.5px] md:border-dashed md:border-line",
  filled: "md:rounded-[24px] md:border-[1.5px] md:border-transparent md:bg-surface md:shadow-card",
} as const;

/**
 * A Today meal card (spec §6.1): icon tile, then three fixed one-line rows (name, items, kcal) and a
 * round "+". Every card is the same height, filled or empty, however many or long the items: each row
 * has a set line height and never wraps (the items line truncates), and the card's min height is that
 * filled layout. An empty meal keeps the dashed border, "Nothing logged yet" and a muted "0 kcal".
 * Tapping a filled card expands its entries, each of which opens the edit sheet: inside the card on
 * phones, as a full-width row under the pair on desktop (see CARD_ORDER).
 */
export function MealSection({ meal, date, entries, kcal, index }: { meal: Meal; date: string; entries: EntryRow[]; kcal: number; index: 0 | 1 | 2 | 3 }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const { label, icon: Icon } = MEAL_META[meal];
  const empty = entries.length === 0;
  const kcalText = `${Math.round(kcal).toLocaleString("en-IN")} kcal`;

  const head = (
    <>
      <IconTile tone="brand" size="md" className="[&_svg]:size-[22px]">
        <Icon />
      </IconTile>
      <span className="block min-w-0 flex-1">
        <span className="block truncate text-base leading-[21px] font-semibold text-ink">{label}</span>
        <span className="block truncate text-[13px] leading-[19px] text-subtle">{empty ? "Nothing logged yet" : summary(entries)}</span>
        <span className={cn("num mt-1.5 flex h-[19px] items-center gap-[5px] text-[13px] font-semibold whitespace-nowrap", empty ? "text-subtle" : "text-ink")}>
          <Flame className={cn("size-3.5 shrink-0", empty ? "text-subtle" : "text-grade-d")} aria-hidden />
          {kcalText}
        </span>
      </span>
    </>
  );

  return (
    <div className={cn("rounded-[24px] md:contents", BOX[empty ? "empty" : "filled"])}>
      <section
        aria-label={label}
        data-meal-card={meal}
        className={cn(
          // 2 × 14 px padding + 21 + 19 + 6 + 19 px of rows = 93 px: the filled layout, for every card
          // (plus the 1.5 px borders from 900 px, where the border is on the card itself: 96 px).
          "flex min-h-[93px] min-w-0 md:min-h-[96px] items-center gap-3 py-3.5 pr-3.5 pl-4",
          MD_BOX[empty ? "empty" : "filled"],
          CARD_ORDER[index],
        )}
      >
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
      </section>
      {!empty && (
        <div
          id={listId}
          role="group"
          aria-label={`${label} entries`}
          hidden={!open}
          className={cn(
            "divide-y divide-line border-t border-line",
            "md:col-span-2 md:rounded-[24px] md:border-t-0 md:bg-surface md:shadow-card",
            LIST_ORDER[index],
          )}
        >
          <p aria-hidden className="m-0 hidden min-h-11 items-center justify-between gap-3 px-4 text-[13px] font-semibold whitespace-nowrap text-subtle md:flex">
            <span className="truncate">{label} · {entries.length} {entries.length === 1 ? "item" : "items"}</span>
            <span className="num">{kcalText}</span>
          </p>
          {entries.map((entry) => <EntryRowButton key={entry.id} entry={entry} />)}
        </div>
      )}
    </div>
  );
}
