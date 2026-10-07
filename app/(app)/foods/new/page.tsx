import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getOwnCustomFoodForEdit } from "@/lib/foods/service";
import { nutrientsFor } from "@/lib/nutrition/portions";
import { BackButton } from "@/components/nav/back-button";
import { CustomFoodForm, type CustomFoodFormInitial } from "@/components/food/custom-food-form";

export default async function NewFoodPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { userId } = await requireUser();
  const editId = (await searchParams).edit;

  let initial: CustomFoodFormInitial | null = null;
  if (editId) {
    // As stored (no read guard): the form shows every value, never silently dropping one.
    const existing = await getOwnCustomFoodForEdit(userId, editId);
    if (!existing) notFound();
    const servingPortion = existing.portions.find((p) => p.unit === "serving");
    initial = {
      id: existing.id,
      name: existing.name,
      brand: existing.brand ?? "",
      per: servingPortion ? { amount: 1, unit: "serving" } : { amount: 100, unit: existing.basis === "per_100ml" ? "ml" : "g" },
      servingGrams: servingPortion?.grams ?? undefined,
      nutrients: servingPortion?.grams ? nutrientsFor(existing.per100, servingPortion.grams) : existing.per100,
    };
  }

  return (
    <div data-no-phone-nav className="mx-auto flex w-full max-w-[560px] flex-col gap-3">
      <div className="flex items-center justify-between gap-2.5">
        <BackButton fallback={initial ? `/foods/${initial.id}` : "/foods"} />
        <h1 className="m-0 min-w-0 truncate text-center text-[17px] font-semibold whitespace-nowrap text-ink">{initial ? "Edit food" : "Create food"}</h1>
        <span className="size-11 shrink-0" aria-hidden />
      </div>
      <CustomFoodForm initial={initial} />
    </div>
  );
}
