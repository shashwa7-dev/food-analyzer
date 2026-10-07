import Link from "next/link";
import { Plus } from "lucide-react";
import type { Meal } from "@/lib/nutrition/types";

/** The round "+" on a Today meal card: opens the full-page food search for that meal and date. */
export function AddFoodButton({ meal, date, label }: { meal: Meal; date: string; label: string }) {
  return (
    <Link
      href={`/foods?${new URLSearchParams({ meal, date })}`}
      aria-label={`Add to ${label.toLowerCase()}`}
      className="grid size-11 shrink-0 place-items-center rounded-full bg-sunken text-ink transition-colors hover:bg-line"
    >
      <Plus className="size-5" aria-hidden />
    </Link>
  );
}
