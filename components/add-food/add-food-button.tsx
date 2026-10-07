"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { AddFoodSheet } from "@/components/add-food/add-food-sheet";
import type { Meal } from "@/lib/nutrition/types";

/** The round "+" on a Today meal card: opens the add-food sheet for that meal and date. */
export function AddFoodButton({ meal, date, label }: { meal: Meal; date: string; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Add to ${label.toLowerCase()}`}
        className="grid size-11 shrink-0 place-items-center rounded-full bg-sunken text-ink transition-colors hover:bg-line"
      >
        <Plus className="size-5" aria-hidden />
      </button>
      <AddFoodSheet meal={meal} date={date} open={open} onOpenChange={setOpen} />
    </>
  );
}
