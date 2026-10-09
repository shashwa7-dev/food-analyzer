import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { customFoodFormInitial, getOwnCustomFoodForEdit } from "@/lib/foods/service";
import { BackButton } from "@/components/nav/back-button";
import { CustomFoodForm } from "@/components/food/custom-food-form";
import type { CustomFoodFormInitial } from "@/lib/foods/service";

export const metadata = { title: "New food" };

export default async function NewFoodPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { userId } = await requireUser();
  const editId = (await searchParams).edit;

  let initial: CustomFoodFormInitial | null = null;
  if (editId) {
    // As stored (no read guard): the form shows every value, never silently dropping one.
    const existing = await getOwnCustomFoodForEdit(userId, editId);
    if (!existing) notFound();
    initial = customFoodFormInitial(existing);
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
