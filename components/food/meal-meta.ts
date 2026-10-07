import { Cookie, Moon, Sun, Sunrise, type LucideIcon } from "lucide-react";
import type { Meal } from "@/lib/nutrition/types";

/** Display name and icon per meal (mock-c1: sunrise, sun, cookie, moon). */
export const MEAL_META: Record<Meal, { label: string; icon: LucideIcon }> = {
  breakfast: { label: "Breakfast", icon: Sunrise },
  lunch: { label: "Lunch", icon: Sun },
  snack: { label: "Snacks", icon: Cookie },
  dinner: { label: "Dinner", icon: Moon },
};

/** Meals in the order of the day, as Today's cards and the sheets' meal tiles show them. */
export const DAY_MEALS: Meal[] = ["breakfast", "lunch", "snack", "dinner"];
