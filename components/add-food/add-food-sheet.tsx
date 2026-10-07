"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Button } from "@/components/ui/button";
import { AddToMeal } from "@/components/food/add-to-meal";
import { FlagNotes, FoodSheetHeader } from "@/components/food/sheet-parts";
import { INGREDIENTS_UNKNOWN_NOTE } from "@/components/food/ingredients-unknown-note";
import { api } from "@/lib/api-client";
import { sourceLine } from "@/lib/foods/display";
import { foodIconKey } from "@/lib/foods/icon";
import type { FoodHit } from "@/lib/foods/types";
import type { Flag, Meal, Nutrients, Portion } from "@/lib/nutrition/types";

type DetailFood = {
  id: string; name: string; brand: string | null; grade: string | null; source: string; kind: string;
  per100: Nutrients; portions: Portion[]; defaultPortion: number; basis: "per_100g" | "per_100ml";
  barcode: string | null; gradeCategory: string | null; categories: string[];
};
type Detail = { food: DetailFood; flags: Flag[]; ingredientsKnown: boolean };
type Me = { profile: { allergies: string[] } };

function Skeleton() {
  const block = "rounded-[22px] bg-sunken animate-pulse motion-reduce:animate-none";
  return (
    <div className="flex flex-col gap-3.5" aria-busy="true" aria-label="Loading">
      <div className={`${block} h-16`} />
      <div className={`${block} h-11 rounded-[13px]`} />
      <div className={`${block} h-[58px] rounded-[13px]`} />
      <div className={`${block} h-5 rounded-full`} />
      <div className={`${block} h-[54px] rounded-full`} />
    </div>
  );
}

function AddFoodSheetBody({ hit, meal, date, onClose }: { hit: FoodHit; meal: Meal; date: string; onClose: () => void }) {
  const detail = useQuery({ queryKey: ["foods", hit.id], queryFn: () => api<Detail>(`/api/v1/foods/${hit.id}`) });
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/api/v1/me") });
  const food = detail.data?.food;
  const iconKey = food ? foodIconKey(food) : (hit.iconKey ?? foodIconKey(hit));
  const hasAllergies = (me.data?.profile.allergies.length ?? 0) > 0;

  return (
    <>
      <FoodSheetHeader iconKey={iconKey} name={hit.name} subtitle={sourceLine(food ?? hit)} grade={food?.grade ?? hit.grade} />
      {detail.isPending && <Skeleton />}
      {detail.isError && (
        <div className="flex flex-col items-start gap-2 rounded-[18px] bg-surface p-4 shadow-card">
          <p className="m-0 text-sm text-ink">Couldn’t load that food.</p>
          <Button type="button" variant="ghost-sunken" shape="pill" size="lg" onClick={() => void detail.refetch()}>Try again</Button>
        </div>
      )}
      {food && detail.data && (
        <AddToMeal
          food={food}
          target={{ kind: "food", foodId: food.id }}
          date={date}
          defaultMeal={meal}
          onDone={onClose}
          notes={<FlagNotes flags={detail.data.flags} note={!detail.data.ingredientsKnown && hasAllergies ? INGREDIENTS_UNKNOWN_NOTE : null} />}
        />
      )}
      <Link
        href={`/foods/${hit.id}`}
        className="-my-1.5 inline-flex min-h-11 items-center justify-center gap-1 self-center rounded-full px-3 text-[13px] font-semibold whitespace-nowrap text-brand-deep"
      >
        Nutrition and details
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </>
  );
}

/**
 * The add-food sheet (spec §6.3), opened by tapping a search row: the food's icon, name, source and
 * grade, then AddToMeal with the user's personal flags above the button. A bottom sheet on phones,
 * a dialog from 900 px. The caller keeps `hit` set while it closes, so the sheet doesn't empty mid-animation.
 */
export function AddFoodSheet({ hit, session, meal, date, open, onOpenChange }: {
  hit: FoodHit | null; session: number; meal: Meal; date: string; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  return (
    <ResponsiveSheet open={open && hit !== null} onOpenChange={onOpenChange}>
      {hit && <AddFoodSheetBody key={`${hit.id}:${session}`} hit={hit} meal={meal} date={date} onClose={() => onOpenChange(false)} />}
    </ResponsiveSheet>
  );
}
