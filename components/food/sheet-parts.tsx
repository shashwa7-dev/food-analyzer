"use client";
import { useId, type ReactNode } from "react";
import { ChevronDown, Droplet, Drumstick, Flame, Info, ShieldAlert, TriangleAlert, Wheat } from "lucide-react";
import { DAY_MEALS, MEAL_META } from "@/components/food/meal-meta";
import { FoodIcon } from "@/components/food/food-icon";
import { GradeBadge } from "@/components/grade-badge";
import { SheetTitle } from "@/components/ui/responsive-sheet";
import type { FoodIconKey } from "@/lib/foods/icon";
import { cn } from "@/lib/utils";
import type { Flag, Meal } from "@/lib/nutrition/types";

/** The add sheet's head (mock-c1 `.sheet-head`): the food's icon, its name (the sheet's title) and a source line, then its grade. */
export function FoodSheetHeader({ iconKey, name, subtitle, grade }: { iconKey: FoodIconKey; name: string; subtitle: ReactNode; grade: string | null }) {
  return (
    <div className="flex items-center gap-3">
      <FoodIcon iconKey={iconKey} size="lg" tone="brand" />
      <div className="min-w-0 flex-1 leading-tight">
        <SheetTitle className="block truncate text-[18px] font-semibold tracking-[-0.02em] text-ink">{name}</SheetTitle>
        <span className="block truncate text-[13px] text-subtle">{subtitle}</span>
      </div>
      <GradeBadge grade={grade} size="md" />
    </div>
  );
}

/**
 * Portion chips plus Grams (mock-c1 `.units`): one row that never wraps; it scrolls sideways when the
 * food has many portions. `wrap` (the food page's narrow add panel) lets them wrap onto more rows
 * instead, so no chip is ever clipped. An option's `title` (its full label, when `label` is shortened)
 * is its accessible name and tooltip.
 */
export function UnitChips({ options, active, onPick, wrap = false }: {
  options: { key: string; label: string; title?: string }[];
  active: string;
  onPick: (key: string) => void;
  wrap?: boolean;
}) {
  return (
    <div className={cn("flex gap-1.5", wrap ? "flex-wrap" : "overflow-x-auto [scrollbar-width:none]")} role="group" aria-label="Unit">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={o.key === active}
          aria-label={o.title}
          title={o.title}
          onClick={() => onPick(o.key)}
          className="min-h-11 max-w-[220px] flex-1 shrink-0 basis-auto truncate rounded-[13px] border border-line bg-surface px-3.5 text-[13px] font-semibold whitespace-nowrap text-subtle transition-colors aria-pressed:border-transparent aria-pressed:bg-action aria-pressed:text-action-ink"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The unit as a native select (the add panel, when a food has more portions than fit as chips): the field row of MealSelect. */
export function UnitSelect({ options, active, onPick }: { options: { key: string; label: string; title?: string }[]; active: string; onPick: (key: string) => void }) {
  const id = useId();
  const current = options.find((o) => o.key === active);
  return (
    <div className="relative flex min-h-[52px] items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-3.5 focus-within:ring-2 focus-within:ring-brand-deep">
      <label htmlFor={id} className="text-sm text-subtle">Unit</label>
      <span className="inline-flex min-w-0 items-center gap-2 font-semibold whitespace-nowrap text-ink" aria-hidden>
        <span className="truncate">{current?.label}</span>
        <ChevronDown className="size-[18px] shrink-0 text-subtle" />
      </span>
      <select
        id={id}
        value={active}
        onChange={(e) => onPick(e.target.value)}
        className="absolute inset-0 size-full cursor-pointer appearance-none rounded-2xl opacity-0"
      >
        {options.map((o) => <option key={o.key} value={o.key}>{o.title ?? o.label}</option>)}
      </select>
    </div>
  );
}

/** Four meal tiles with their icons (mock-c1 `.meals`); the chosen one is brand-soft with a lime border. */
export function MealTiles({ meal, onPick }: { meal: Meal; onPick: (meal: Meal) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Meal">
      {DAY_MEALS.map((m) => {
        const { label, icon: Icon } = MEAL_META[m];
        return (
          <button
            key={m}
            type="button"
            aria-pressed={m === meal}
            onClick={() => onPick(m)}
            className="flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-[3px] rounded-[13px] border border-line bg-surface text-[11.5px] font-semibold whitespace-nowrap text-subtle transition-colors aria-pressed:border-brand aria-pressed:bg-brand-soft aria-pressed:text-on-brand-soft"
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** The edit sheet's "Meal" field row (mock-c1 `.field`): a native select under a styled value. */
export function MealSelect({ meal, onPick }: { meal: Meal; onPick: (meal: Meal) => void }) {
  const id = useId();
  const { label, icon: Icon } = MEAL_META[meal];
  return (
    <div className="relative flex min-h-[52px] items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-3.5 focus-within:ring-2 focus-within:ring-brand-deep">
      <label htmlFor={id} className="text-sm text-subtle">Meal</label>
      <span className="inline-flex items-center gap-2 font-semibold whitespace-nowrap text-ink" aria-hidden>
        <Icon className="size-[18px]" />
        {label}
        <ChevronDown className="size-[18px] text-subtle" />
      </span>
      <select
        id={id}
        value={meal}
        onChange={(e) => onPick(e.target.value as Meal)}
        className="absolute inset-0 size-full cursor-pointer appearance-none rounded-2xl opacity-0"
      >
        {DAY_MEALS.map((m) => <option key={m} value={m}>{MEAL_META[m].label}</option>)}
      </select>
    </div>
  );
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");

/** kcal, protein, carbs and fat for the amount chosen (mock-c1 `.mini-macros`), each macro in its own colour. */
export function LiveMacros({ kcal, protein, carbs, fat }: { kcal: number; protein: number; carbs: number; fat: number }) {
  const item = "inline-flex items-center gap-[5px] whitespace-nowrap [&_svg]:size-4";
  return (
    <p className="num m-0 flex justify-between gap-2 px-1 text-[13.5px] font-semibold text-ink">
      <span className={item}><Flame className="text-grade-d" aria-hidden />{fmt(kcal)} kcal</span>
      <span className={cn(item, "text-protein-ink")}><Drumstick aria-hidden />{fmt(protein)} g<span className="sr-only"> protein</span></span>
      <span className={cn(item, "text-carbs-ink")}><Wheat aria-hidden />{fmt(carbs)} g<span className="sr-only"> carbs</span></span>
      <span className={cn(item, "text-fat-ink")}><Droplet aria-hidden />{fmt(fat)} g<span className="sr-only"> fat</span></span>
    </p>
  );
}

/**
 * Personal flags from M1 above the add button: allergen and diet warnings in the bad tone (announced
 * as alerts), goal notes and the "no ingredient list" caveat quieter on --sunken. They're sentences,
 * so they may run to two lines; they aren't buttons.
 */
export function FlagNotes({ flags, note }: { flags: Flag[]; note?: string | null }) {
  if (flags.length === 0 && !note) return null;
  return (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
      {flags.map((f) => {
        const warn = f.type !== "goal";
        const Icon = warn ? ShieldAlert : TriangleAlert;
        return (
          <li
            key={f.type + f.key}
            role={warn ? "alert" : undefined}
            className={cn(
              "flex items-start gap-2 rounded-[14px] px-3 py-2.5 text-[13px] leading-snug",
              warn ? "bg-bad/10 font-medium text-ink" : "bg-sunken text-ink",
            )}
          >
            <Icon className={cn("mt-px size-4 shrink-0", warn ? "text-bad" : "text-warn")} aria-hidden />
            {f.text}
          </li>
        );
      })}
      {note && (
        <li className="flex items-start gap-2 rounded-[14px] bg-sunken px-3 py-2.5 text-[13px] leading-snug text-subtle">
          <Info className="mt-px size-4 shrink-0" aria-hidden />
          {note}
        </li>
      )}
    </ul>
  );
}
