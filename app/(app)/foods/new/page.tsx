import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getFoodForUser } from "@/lib/foods/service";
import { nutrientsFor } from "@/lib/nutrition/portions";
import { CustomFoodForm, type CustomFoodFormInitial } from "@/components/food/custom-food-form";

export default async function NewFoodPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { userId } = await requireUser();
  const editId = (await searchParams).edit;

  let initial: CustomFoodFormInitial | null = null;
  if (editId) {
    const existing = await getFoodForUser(userId, editId);
    if (!existing || existing.source !== "custom") notFound();
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
    <div className="flex flex-col gap-4">
      <h1 className="title text-[30px] md:text-[34px]">{initial ? "Edit food" : "Create food"}</h1>
      <CustomFoodForm initial={initial} />
    </div>
  );
}
