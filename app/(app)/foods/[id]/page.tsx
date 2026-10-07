import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { foodDetail } from "@/lib/foods/service";
import { defaultMealIn, todayIn } from "@/lib/dates";
import { GradeStrip, GradeBadge } from "@/components/grade-badge";
import { AddToMeal } from "@/components/food/add-to-meal";
import { FoodOwnerActions } from "@/components/food/food-owner-actions";
import { FlagList, ReasonList } from "@/components/food/food-verdict";
import { IndbSodiumNote } from "@/components/food/indb-sodium-note";
import { IngredientsUnknownNote } from "@/components/food/ingredients-unknown-note";
import { nutrientsFor } from "@/lib/nutrition/portions";
import { NutritionTable } from "@/components/food/nutrition-table";
import Link from "next/link";

export default async function FoodPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId, profile } = await requireUser();
  const detail = await foodDetail(userId, (await params).id);
  if (!detail) notFound();
  const { food, reasons, flags, alternatives, ingredientsKnown } = detail;
  const p = food.portions[food.defaultPortion] ?? food.portions[0]!;
  const n = p.grams ? nutrientsFor(food.per100, p.grams) : food.per100;
  const defaultMeal = defaultMealIn(profile.timezone);
  return (
    <div className="flex flex-col gap-4">
      <header>
        <div className="text-sm text-subtle capitalize">{food.kind === "ingredient" ? "Ingredient" : food.kind}</div>
        <h1 className="title text-[30px] md:text-[34px]">{food.name}</h1>{food.brand && <div className="text-sm text-subtle">{food.brand}</div>}
        {food.source === "custom" && <div className="mt-3"><FoodOwnerActions id={food.id} name={food.name} /></div>}
      </header>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr] lg:items-start">
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3.5"><GradeStrip grade={food.grade} />
              {food.gradeValue !== null && <div className="text-right"><div className="num text-[26px] font-bold">{food.gradeValue}<span className="text-sm text-subtle">/100</span></div><div className="text-sm text-subtle">Health score</div></div>}</div>
            <ReasonList reasons={reasons} />
          </section>
          <FlagList flags={flags} />
          <IngredientsUnknownNote ingredientsKnown={ingredientsKnown} hasAllergies={profile.allergies.length > 0} />
          <section className="rounded-lg border border-line bg-surface p-5 shadow-card">
            <AddToMeal food={food} target={{ kind: "food", foodId: food.id }} date={todayIn(profile.timezone)} defaultMeal={defaultMeal} />
          </section>
        </div>
        <div className="flex flex-col gap-4">
          <section className="rounded-lg border border-line bg-surface p-5 shadow-card">
            <NutritionTable nutrients={n} provenance={food.provenance} portionLabel={p.label} grams={p.grams} unit={food.basis === "per_100ml" ? "ml" : "g"} />
            {food.ingredients.length > 0 && <p className="mt-2.5 text-sm text-subtle">Ingredients: {food.ingredients.join(", ")}</p>}
            <div className="mt-2.5"><IndbSodiumNote source={food.source} /></div>
          </section>
          {alternatives.length > 0 && <section className="rounded-lg border border-line bg-surface p-5 shadow-card"><h2 className="section-title mb-2.5">Healthier options</h2>
            {alternatives.slice(0, 1).map((a) => <Link key={a.id} href={`/foods/${a.id}`} className="flex items-center gap-3 rounded-md border border-line p-3"><GradeBadge grade={a.grade} /><span className="font-semibold">{a.name}</span></Link>)}</section>}
        </div>
      </div>
      <p className="text-sm text-subtle">Information only, not medical advice. Check the pack for allergens.</p>
    </div>
  );
}
