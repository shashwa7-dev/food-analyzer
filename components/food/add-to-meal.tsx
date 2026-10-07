"use client";
import { useState, type ReactNode } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AmountStepper } from "@/components/food/amount-stepper";
import { LiveMacros, MealTiles, UnitChips } from "@/components/food/sheet-parts";
import { MEAL_META } from "@/components/food/meal-meta";
import { useLogEntry } from "@/components/food/use-log-entry";
import { logEntryBody, MAX_QUANTITY, type LogTarget } from "@/lib/log/quantity";
import { minAmount, multiplierUnit, stepAmount, unitChipLabel, unitWord } from "@/lib/log/stepper";
import { parseAmount } from "@/lib/parse-amount";
import type { Meal, Nutrients, Portion, PortionUnit } from "@/lib/nutrition/types";

/** per100 null (+ perServing): a per-serving label with no serving weight — logged by servings only, never by grams. */
export type LoggableFood = { name: string; per100: Nutrients | null; perServing?: Nutrients; portions: Portion[]; defaultPortion: number; basis: "per_100g" | "per_100ml" };

const GRAMS = "grams";
const MAX_GRAMS = 5000;

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The add sheet's controls (spec §6.3): amount stepper, unit chips (the food's portions plus Grams),
 * meal tiles, live macros, `notes` (personal flags) and "Add to {Meal}", then POST /log with the
 * Undo toast. `target` says what the entry is made from — a food (kinds food/grams) or a scan's own
 * result (kinds scan/scan_grams); `food` supplies what's shown in both cases. The bare "100 g"
 * portion every food carries is the Grams chip, not a chip of its own.
 */
export function AddToMeal({ food, target, date, defaultMeal, onDone, notes }: {
  food: LoggableFood; target: LogTarget; date: string; defaultMeal: Meal; onDone?: () => void; notes?: ReactNode;
}) {
  const logEntry = useLogEntry();
  const servingsOnly = food.per100 === null;
  const unit = food.basis === "per_100ml" ? "ml" : "g";
  const chips = food.portions
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => (servingsOnly ? true : p.grams !== null && p.unit !== "g" && p.unit !== "ml"));
  const defaultChip = chips.find(({ i }) => i === food.defaultPortion);
  const initialGrams = food.portions[food.defaultPortion]?.grams ?? 100;
  // Mode: a portion index, or free grams (a food whose default is its "100 g" portion opens on Grams).
  const [mode, setMode] = useState<number | typeof GRAMS>(defaultChip?.i ?? (servingsOnly ? (chips[0]?.i ?? 0) : GRAMS));
  const [quantity, setQuantity] = useState(1);
  const [gramsText, setGramsText] = useState(String(initialGrams));
  const [meal, setMeal] = useState<Meal>(defaultMeal);
  const [pending, setPending] = useState(false);

  const isGrams = mode === GRAMS;
  const portion = isGrams ? null : food.portions[mode];
  const typed = parseAmount(gramsText) ?? Number.NaN;
  const gramsValid = Number.isFinite(typed) && typed >= 1 && typed <= MAX_GRAMS;
  const grams = isGrams ? (gramsValid ? typed : 0) : (portion?.grams ?? 0) * quantity;
  const n: Nutrients = food.per100
    ? { energyKcal: (food.per100.energyKcal * grams) / 100, protein: (food.per100.protein * grams) / 100, carbs: (food.per100.carbs * grams) / 100, fat: (food.per100.fat * grams) / 100 }
    : { energyKcal: (food.perServing?.energyKcal ?? 0) * quantity, protein: (food.perServing?.protein ?? 0) * quantity, carbs: (food.perServing?.carbs ?? 0) * quantity, fat: (food.perServing?.fat ?? 0) * quantity };

  const stepUnit: PortionUnit = isGrams ? unit : multiplierUnit(portion?.unit ?? "serving");
  const amount = isGrams ? (gramsValid ? typed : 0) : quantity;
  const max = isGrams ? MAX_GRAMS : MAX_QUANTITY;
  const step = (dir: 1 | -1) => {
    const next = Math.min(max, stepAmount(amount, stepUnit, dir));
    if (isGrams) setGramsText(String(next));
    else setQuantity(next);
  };
  const pick = (key: string) => {
    if (key === GRAMS) {
      // Carry the weight over, so "1½ katori · 225 g" becomes 225 g.
      if (!isGrams && grams > 0) setGramsText(String(Math.min(MAX_GRAMS, Math.round(grams))));
      setMode(GRAMS);
    } else {
      setMode(Number(key));
    }
  };

  const options = [
    ...chips.map(({ p, i }) => ({ key: String(i), label: unitChipLabel(p.label) })),
    ...(servingsOnly ? [] : [{ key: GRAMS, label: unit === "ml" ? "Millilitres" : "Grams" }]),
  ];
  const sub = isGrams
    ? (unit === "ml" ? "millilitres" : "grams")
    : `${unitWord(portion?.label ?? "", quantity)}${portion?.grams ? ` · ${round1(grams)} ${unit}` : ""}`;
  const canAdd = isGrams ? gramsValid : chips.length > 0;

  async function add() {
    setPending(true);
    const choice = isGrams ? { date, meal, grams: typed } : { date, meal, portionIndex: mode as number, quantity };
    const id = await logEntry(logEntryBody(target, choice), { name: food.name, meal });
    setPending(false);
    if (id) onDone?.();
  }

  return (
    <div className="flex flex-col gap-3.5">
      <AmountStepper
        amount={amount}
        sub={sub}
        onStep={step}
        canDecrease={amount > minAmount(stepUnit)}
        canIncrease={amount < max}
        input={isGrams ? { value: gramsText, onChange: setGramsText, invalid: !gramsValid, label: `Amount in ${unit}` } : undefined}
      />
      {options.length > 1 && <UnitChips options={options} active={String(mode)} onPick={pick} />}
      <MealTiles meal={meal} onPick={setMeal} />
      <LiveMacros kcal={n.energyKcal} protein={n.protein} carbs={n.carbs} fat={n.fat} />
      {notes}
      <Button type="button" shape="pill" size="xl" className="h-[54px] w-full" disabled={pending || !canAdd} onClick={() => void add()}>
        {pending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Plus aria-hidden />}
        {pending ? "Adding…" : `Add to ${MEAL_META[meal].label}`}
      </Button>
    </div>
  );
}
