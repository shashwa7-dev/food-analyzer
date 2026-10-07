"use client";
import { useState } from "react";
import Link from "next/link";
import { AddFoodSheet } from "@/components/add-food/add-food-sheet";
import { FoodSearch } from "@/components/add-food/food-search";
import { BackButton } from "@/components/nav/back-button";
import type { FoodHit } from "@/lib/foods/types";
import type { Meal } from "@/lib/nutrition/types";

/**
 * /foods (spec §6.2): a top bar (back, "Add to {Meal}" over the date, or "Foods"), the search body
 * and the add sheet for the row that was tapped. `meal`/`date` come from the "+" that opened it;
 * `backHref` is where Back goes when there's no history to return to.
 */
export function FoodsPageSearch({ title, subtitle, meal, date, backHref }: {
  title: string; subtitle: string | null; meal: Meal; date: string; backHref: string;
}) {
  const [hit, setHit] = useState<FoodHit | null>(null);
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);

  return (
    <div data-no-phone-nav className="mx-auto flex w-full max-w-[720px] flex-col gap-3">
      <div className="flex items-center justify-between gap-2.5">
        <BackButton fallback={backHref} />
        <div className="min-w-0 text-center leading-[1.2]">
          <h1 className="m-0 truncate text-[17px] font-semibold whitespace-nowrap text-ink">{title}</h1>
          {subtitle && <p className="m-0 truncate text-[12.5px] text-subtle">{subtitle}</p>}
        </div>
        <span className="size-11 shrink-0" aria-hidden />
      </div>
      <FoodSearch
        meal={meal}
        date={date}
        onOpen={(h) => {
          setHit(h);
          setSession((n) => n + 1);
          setOpen(true);
        }}
      />
      <p className="m-0 mt-1 flex flex-wrap items-center gap-x-1 px-1 text-[12.5px] text-subtle">
        Data: INDB, USDA FoodData Central, Open Food Facts.
        <Link href="/about/data" className="inline-flex min-h-11 items-center underline">Learn more</Link>
      </p>
      <AddFoodSheet hit={hit} session={session} meal={meal} date={date} open={open} onOpenChange={setOpen} />
    </div>
  );
}
