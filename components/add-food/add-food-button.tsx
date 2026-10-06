"use client";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { Meal } from "@/lib/nutrition/types";

// Task 15 will replace this navigation with an <AddFoodSheet meal date /> opened on click.
export function AddFoodButton({ meal, date }: { meal: Meal; date: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(`/foods?date=${date}&meal=${meal}`)}
      className="flex min-h-12 w-full items-center gap-2 border-t border-line px-5 py-3.5 font-semibold text-accent"
    >
      <Plus className="size-4" aria-hidden />
      Add to {meal}
    </button>
  );
}
