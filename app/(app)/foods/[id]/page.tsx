import Link from "next/link";
import { notFound } from "next/navigation";
import { Database } from "lucide-react";
import { requireUser } from "@/lib/session";
import { foodDetail } from "@/lib/foods/service";
import { SOURCE_NAME, SOURCE_SHORT, sourceLine } from "@/lib/foods/display";
import { foodIconKey } from "@/lib/foods/icon";
import { defaultMealIn, todayIn } from "@/lib/dates";
import { moreNutrientRows, vitaminMineralRows } from "@/lib/nutrition/nutrient-display";
import { nutrientsFor } from "@/lib/nutrition/portions";
import { oneLineReason, packSize, typicalPortion, warningFlags } from "@/lib/scans/result-display";
import type { Grade } from "@/lib/nutrition/types";
import {
  BetterPick, BigCalories, CATEGORY, DietChip, DV_NOTE, fmt, FoodTitle, MacroCards, NutrientGrid, VerdictLine,
} from "@/components/food/result-parts";
import { DetailTabs } from "@/components/food/detail-tabs";
import { FoodAddBar, FoodAddPanel, FoodTopBar } from "@/components/food/food-detail-actions";
import { ReasonList } from "@/components/food/food-verdict";
import { IndbSodiumNote } from "@/components/food/indb-sodium-note";
import { IngredientsUnknownNote, INGREDIENTS_UNKNOWN_NOTE } from "@/components/food/ingredients-unknown-note";
import { FullNutritionTable, PROVENANCE_LABEL, dominantProvenance } from "@/components/food/nutrition-table";
import { FlagNotes } from "@/components/food/sheet-parts";

/**
 * A food's page (mock-c1 "Food detail", option C). Left: the name, one verdict line, big calories,
 * Protein/Carbs/Fat cards, every other nutrient the food holds as cards (vitamins and minerals with
 * % DV), then tabs for why it got its grade and its ingredients (with the full table). Right, from
 * 900 px: a sticky "Add to a meal" card and the better pick. Phones stack, with the better pick inline
 * and the sticky "Add to {Meal}" bar that opens the add sheet.
 */
export default async function FoodPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId, profile } = await requireUser();
  const detail = await foodDetail(userId, (await params).id);
  if (!detail) notFound();
  const { food, reasons, flags, alternatives, ingredientsKnown, gradeUnavailable } = detail;
  const unit = food.basis === "per_100ml" ? "ml" : "g";
  const per = `per 100 ${unit}`;
  const typical = typicalPortion(food.portions, food.defaultPortion);
  const portionText = typical ? `${typical.label} = ${fmt((food.per100.energyKcal * typical.grams!) / 100)} kcal` : null;
  const iconKey = foodIconKey(food);
  const grade = food.grade as Grade | null;
  const goalFlags = flags.filter((f) => f.type === "goal");
  const hasAllergies = profile.allergies.length > 0;
  const owner = food.source === "custom" && food.ownerId === userId;
  // "Amul · Packaged · 200 g pack · per 100 g"; a reference food names its table instead of a brand ("Dish · INDB · per 100 g").
  const kindWord = food.source === "custom" ? "My food" : iconKey === "default" ? null : CATEGORY[iconKey];
  const meta = [food.brand, kindWord, packSize(food.portions, unit), food.source === "indb" || food.source === "fndds" ? SOURCE_SHORT[food.source] : null, per]
    .filter(Boolean).join(" · ");
  const loggable = { name: food.name, per100: food.per100, portions: food.portions, defaultPortion: food.defaultPortion, basis: food.basis };
  const date = todayIn(profile.timezone);
  const meal = defaultMealIn(profile.timezone);
  const better = <BetterPick alt={alternatives[0]} />;
  const whyLabel = gradeUnavailable || !grade ? "Why no grade" : `Why ${grade}`;
  const provenance = dominantProvenance(food.provenance);

  const why = (
    <div className="flex flex-col gap-3 text-[14px]">
      <ReasonList reasons={reasons} />
      <FlagNotes flags={goalFlags} />
    </div>
  );
  const ingredients = (
    <div className="flex flex-col gap-3 text-[14px]">
      {food.ingredients.length > 0
        ? <p className="m-0 leading-normal text-ink">{food.ingredients.join(", ")}</p>
        : <p className="m-0 text-subtle">No ingredient list for this food.</p>}
      <IndbSodiumNote source={food.source} />
      {SOURCE_NAME[food.source] && (
        food.source === "custom" ? (
          <p className="m-0 inline-flex items-center gap-1.5 text-[13px] text-subtle"><Database className="size-3.5 shrink-0" aria-hidden />{SOURCE_NAME.custom}</p>
        ) : (
          <Link href="/about/data" className="-my-2 inline-flex min-h-11 items-center gap-1.5 self-start text-[13px] text-subtle underline-offset-2 hover:underline">
            <Database className="size-3.5 shrink-0" aria-hidden />{SOURCE_NAME[food.source]} · {PROVENANCE_LABEL[provenance].toLowerCase()}
          </Link>
        )
      )}
      <FullNutritionTable
        per100={food.per100}
        portion={typical ? { label: typical.label, grams: typical.grams, nutrients: nutrientsFor(food.per100, typical.grams!) } : null}
        provenance={food.provenance}
        unit={unit}
      />
    </div>
  );

  return (
    <div data-no-phone-nav className="mx-auto flex w-full max-w-[1040px] flex-col gap-4">
      <FoodTopBar foodId={food.id} owner={owner} />

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px] md:items-start md:gap-6">
        <div className="flex min-w-0 flex-col gap-4">
          <FoodTitle name={food.name} meta={meta} />
          <VerdictLine
            grade={grade}
            reason={oneLineReason(reasons, grade)}
            unavailable={gradeUnavailable}
            chip={<DietChip diet={profile.diet} flags={flags} ingredientsKnown={ingredientsKnown} />}
          />
          <FlagNotes flags={warningFlags(flags)} />
          <IngredientsUnknownNote ingredientsKnown={ingredientsKnown} hasAllergies={hasAllergies} />
          <BigCalories kcal={food.per100.energyKcal} basis={per} portion={portionText} />
          <MacroCards n={food.per100} />
          {alternatives[0] && <div className="md:hidden">{better}</div>}
          <NutrientGrid title="More nutrients" basis={per} rows={moreNutrientRows(food.per100, food.per100, food.basis)} />
          <NutrientGrid title="Vitamins & minerals" basis={per} rows={vitaminMineralRows(food.per100)} note={DV_NOTE} />
          <DetailTabs
            label="Details"
            tabs={[{ id: "why", label: whyLabel, panel: why }, { id: "ingredients", label: "Ingredients", panel: ingredients }]}
          />
          <p className="m-0 px-1 text-[13px] text-subtle">Information only, not medical advice. Check the pack for allergens.</p>
        </div>

        <aside className="hidden min-w-0 md:sticky md:top-4 md:block">
          <FoodAddPanel foodId={food.id} food={loggable} date={date} defaultMeal={meal} footer={better} />
        </aside>
      </div>

      <FoodAddBar
        foodId={food.id}
        food={loggable}
        iconKey={iconKey}
        grade={food.grade}
        subtitle={sourceLine(food)}
        flags={flags}
        note={!ingredientsKnown && hasAllergies ? INGREDIENTS_UNKNOWN_NOTE : null}
        date={date}
        defaultMeal={meal}
      />
    </div>
  );
}
