import Link from "next/link";
import { notFound } from "next/navigation";
import { Database, Scale } from "lucide-react";
import { requireUser } from "@/lib/session";
import { foodDetail } from "@/lib/foods/service";
import { SOURCE_NAME, SOURCE_SHORT, sourceLine } from "@/lib/foods/display";
import { foodIconKey } from "@/lib/foods/icon";
import { defaultMealIn, todayIn } from "@/lib/dates";
import { nutrientsFor } from "@/lib/nutrition/portions";
import { oneLineReason, packSize, typicalPortion } from "@/lib/scans/result-display";
import type { Grade } from "@/lib/nutrition/types";
import { FOOD_ICON } from "@/components/food/food-icon";
import {
  BetterPick, CalorieRow, CARD, CATEGORY, FlagChips, fmt, GradeHero, MacroRings, ResultTitle, Tag, Tags, WhyGrade,
} from "@/components/food/result-parts";
import { FoodAddBar, FoodTopBar } from "@/components/food/food-detail-actions";
import { IndbSodiumNote } from "@/components/food/indb-sodium-note";
import { IngredientsUnknownNote, INGREDIENTS_UNKNOWN_NOTE } from "@/components/food/ingredients-unknown-note";
import { NutritionTable } from "@/components/food/nutrition-table";

/**
 * A food's page (spec §6, C1), laid out like a scan result: tag chips, the name, the grade hero with
 * per-100 calories and macro rings, personal flags, a better pick, then "Why this grade" and the
 * nutrition table for the default portion; "Add to {Meal}" stays at the bottom.
 */
export default async function FoodPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId, profile } = await requireUser();
  const detail = await foodDetail(userId, (await params).id);
  if (!detail) notFound();
  const { food, reasons, flags, alternatives, ingredientsKnown } = detail;
  const unit = food.basis === "per_100ml" ? "ml" : "g";
  const p = food.portions[food.defaultPortion] ?? food.portions[0]!;
  const forPortion = p.grams ? nutrientsFor(food.per100, p.grams) : food.per100;
  const typical = typicalPortion(food.portions, food.defaultPortion);
  const portionText = typical ? `${typical.label} = ${fmt((food.per100.energyKcal * typical.grams!) / 100)} kcal` : null;
  const iconKey = foodIconKey(food);
  const pack = packSize(food.portions, unit);
  const grade = food.grade as Grade | null;
  const goalFlags = flags.filter((f) => f.type === "goal");
  const hasAllergies = profile.allergies.length > 0;
  const owner = food.source === "custom" && food.ownerId === userId;

  return (
    <div data-no-phone-nav className="mx-auto flex w-full max-w-[1000px] flex-col gap-3">
      <FoodTopBar foodId={food.id} owner={owner} />
      <Tags>
        <Tag icon={FOOD_ICON[iconKey]}>{CATEGORY[iconKey]}</Tag>
        {pack && <Tag icon={Scale}><span className="num">{pack}</span></Tag>}
        {SOURCE_SHORT[food.source] && <Tag icon={Database}>{SOURCE_SHORT[food.source]}</Tag>}
      </Tags>
      <ResultTitle name={food.name} brand={food.brand} />

      <div className="grid gap-3 lg:grid-cols-[1.05fr_.95fr] lg:items-start lg:gap-4">
        <div className="flex min-w-0 flex-col gap-3">
          <GradeHero grade={grade} reason={oneLineReason(reasons, grade)} />
          <CalorieRow kcal={food.per100.energyKcal} basis={`per 100 ${unit}`} portion={portionText} />
          <MacroRings n={food.per100} />
          <FlagChips flags={flags} sodiumMg={food.per100.sodiumMg} sodiumPer100={food.per100.sodiumMg} diet={profile.diet} ingredientsKnown={ingredientsKnown} />
          <BetterPick alt={alternatives[0]} />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <WhyGrade reasons={reasons} goalFlags={goalFlags} />
          <IngredientsUnknownNote ingredientsKnown={ingredientsKnown} hasAllergies={hasAllergies} />
          <section className={CARD}>
            <NutritionTable nutrients={forPortion} provenance={food.provenance} portionLabel={p.label} grams={p.grams} unit={unit} />
            {food.ingredients.length > 0 && <p className="mt-2.5 mb-0 text-sm text-subtle">Ingredients: {food.ingredients.join(", ")}</p>}
            <div className="mt-2.5"><IndbSodiumNote source={food.source} /></div>
            {SOURCE_NAME[food.source] && (
              food.source === "custom" ? (
                <p className="mt-2.5 mb-0 text-sm text-subtle">Source: {SOURCE_NAME.custom}</p>
              ) : (
                <Link href="/about/data" className="-mb-2 inline-flex min-h-11 items-center gap-1 text-sm text-subtle underline underline-offset-2">
                  Source: {SOURCE_NAME[food.source]}
                </Link>
              )
            )}
          </section>
          <p className="m-0 px-1 text-[13px] text-subtle">Information only, not medical advice. Check the pack for allergens.</p>
        </div>
      </div>

      <FoodAddBar
        foodId={food.id}
        food={{ name: food.name, per100: food.per100, portions: food.portions, defaultPortion: food.defaultPortion, basis: food.basis }}
        iconKey={iconKey}
        grade={food.grade}
        subtitle={sourceLine(food)}
        flags={flags}
        note={!ingredientsKnown && hasAllergies ? INGREDIENTS_UNKNOWN_NOTE : null}
        date={todayIn(profile.timezone)}
        defaultMeal={defaultMealIn(profile.timezone)}
      />
    </div>
  );
}
