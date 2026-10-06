"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { AddFoodSheet } from "@/components/add-food/add-food-sheet";
import type { Meal } from "@/lib/nutrition/types";

export function AddFoodButton({ meal, date }: { meal: Meal; date: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-12 w-full items-center gap-2 border-t border-line px-5 py-3.5 font-semibold text-accent"
      >
        <Plus className="size-4" aria-hidden />
        Add to {meal}
      </button>
      <AddFoodSheet meal={meal} date={date} open={open} onOpenChange={setOpen} />
    </>
  );
}
