import { requireUser } from "@/lib/session";
import { DateSchema, defaultMealIn, todayIn } from "@/lib/dates";
import { dayLabels } from "@/lib/today/headline";
import { MEALS, type Meal } from "@/lib/nutrition/types";
import { MEAL_META } from "@/components/food/meal-meta";
import { FoodsPageSearch } from "@/components/add-food/foods-page-search";

type Params = { meal?: string; date?: string };

/**
 * Full-page food search (spec §6.2). Opened from a meal's "+" as /foods?meal=&date=, which decides
 * where adds go and titles the page "Add to {Meal}"; opened bare (sidebar) it's "Foods" and adds go to
 * today's meal for the current time.
 */
export default async function FoodsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { profile } = await requireUser();
  const sp = await searchParams;
  const today = todayIn(profile.timezone);
  const meal = (MEALS as readonly string[]).includes(sp.meal ?? "") ? (sp.meal as Meal) : null;
  const date = sp.date && DateSchema.safeParse(sp.date).success ? sp.date : today;
  const labels = dayLabels(date);
  return (
    <FoodsPageSearch
      title={meal ? `Add to ${MEAL_META[meal].label}` : "Foods"}
      subtitle={meal ? (date === today ? `Today · ${labels.short}` : labels.long) : null}
      meal={meal ?? defaultMealIn(profile.timezone)}
      date={date}
      backHref={date === today ? "/today" : `/today?date=${date}`}
    />
  );
}
