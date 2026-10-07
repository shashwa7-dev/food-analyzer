"use client";
import { Check, Loader2, Plus } from "lucide-react";
import { GradeBadge } from "@/components/grade-badge";
import { FoodIcon } from "@/components/food/food-icon";
import { portionLine } from "@/lib/foods/display";
import { foodIconKey } from "@/lib/foods/icon";
import { cn } from "@/lib/utils";
import type { FoodHit } from "@/lib/foods/types";

/**
 * One search result (mock-c1 `.frow`): icon tile, name (ellipsised), "{portion} · {g} g", kcal, grade
 * and a round quick-add. Tapping the row opens the add sheet; the round button logs the default
 * portion straight away and shows a lime check while `added`. The quick-add circle is 36 px inside a
 * 44 px tap target.
 */
export function FoodRow({ food, onQuickAdd, onOpen, added, pending = false }: {
  food: FoodHit;
  onQuickAdd: () => void;
  onOpen: () => void;
  added: boolean;
  pending?: boolean;
}) {
  const kcal = food.defaultPortion.kcal;
  return (
    <li className="flex items-center gap-1 pr-1.5">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-[60px] min-w-0 flex-1 items-center gap-2.5 rounded-[18px] py-2.5 pl-3 text-left outline-none! focus-visible:ring-2 focus-visible:ring-brand-deep focus-visible:ring-inset"
      >
        <FoodIcon iconKey={food.iconKey ?? foodIconKey(food)} />
        <span className="block min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[14.5px] font-semibold text-ink">
            {food.name}
            {food.brand && <span className="font-normal text-subtle"> · {food.brand}</span>}
          </span>
          <span className="num block truncate text-[12.5px] text-subtle">{portionLine(food.defaultPortion, food.defaultPortion.unit)}</span>
        </span>
        {kcal !== null && (
          <span className="num shrink-0 text-right text-sm leading-[1.1] font-[650] whitespace-nowrap text-ink">
            {kcal.toLocaleString("en-IN")}
            <small className="block text-[10.5px] font-medium text-subtle">kcal</small>
          </span>
        )}
        <GradeBadge grade={food.grade} size="sm" />
      </button>
      <button
        type="button"
        onClick={onQuickAdd}
        disabled={pending}
        aria-label={added ? `${food.name} added` : `Quick add ${food.name}`}
        className="group/qadd grid size-11 shrink-0 place-items-center rounded-full outline-none!"
      >
        <span
          className={cn(
            "grid size-9 place-items-center rounded-full transition-colors group-focus-visible/qadd:ring-2 group-focus-visible/qadd:ring-brand-deep [&_svg]:size-[18px]",
            added ? "bg-brand text-brand-ink" : "bg-sunken text-ink group-hover/qadd:bg-line",
          )}
        >
          {pending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : added ? <Check aria-hidden /> : <Plus aria-hidden />}
        </span>
      </button>
    </li>
  );
}
