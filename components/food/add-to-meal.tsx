"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { logEntryBody, stepQuantity, type LogTarget } from "@/lib/log/quantity";
import { MEALS, type Meal, type Nutrients, type Portion } from "@/lib/nutrition/types";

export type LoggableFood = { name: string; per100: Nutrients; portions: Portion[]; defaultPortion: number; basis: "per_100g" | "per_100ml" };

/**
 * Portion chips, quantity stepper / custom grams and meal chips, then POST /log. `target` says what
 * the entry is made from — a food (kinds food/grams) or a scan's own result (kinds scan/scan_grams);
 * `food` supplies what's shown (name, portions, per-100 nutrients) in both cases.
 */
export function AddToMeal({ food, target, date, defaultMeal, onDone }: {
  food: LoggableFood; target: LogTarget; date: string; defaultMeal: Meal; onDone?: () => void;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const loggable = food.portions.map((p, i) => ({ p, i })).filter(({ p }) => p.grams);
  const [portionIndex, setPortionIndex] = useState(loggable.find(({ i }) => i === food.defaultPortion)?.i ?? loggable[0]?.i ?? 0);
  const [quantity, setQuantity] = useState(1);
  const [meal, setMeal] = useState<Meal>(defaultMeal);
  const [custom, setCustom] = useState(false);
  const [customText, setCustomText] = useState("100");
  const customGrams = Number(customText);
  const customValid = customText.trim() !== "" && Number.isFinite(customGrams) && customGrams >= 1 && customGrams <= 5000;
  const grams = custom ? (customValid ? customGrams : 0) : (food.portions[portionIndex]?.grams ?? 0) * quantity;
  const kcal = Math.round((food.per100.energyKcal * grams) / 100);
  const unit = food.basis === "per_100ml" ? "ml" : "g";
  const step = (dir: 1 | -1) => setQuantity((q) => stepQuantity(q, dir));
  const add = useMutation({
    mutationFn: () => api("/api/v1/log", {
      method: "POST",
      body: JSON.stringify(logEntryBody(target, custom ? { date, meal, grams: customGrams } : { date, meal, portionIndex, quantity })),
    }),
    onSuccess: () => {
      toast.success(`Added ${food.name} to ${meal}.`);
      void qc.invalidateQueries({ queryKey: ["foods", "recent"] });
      router.refresh();
      onDone?.();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't add that. Try again."),
  });
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2"><legend className="section-title mb-2">Portion</legend>
        <div className="flex flex-wrap gap-2">
          {loggable.map(({ p, i }) => (
            <button key={p.label} type="button" aria-pressed={!custom && i === portionIndex} onClick={() => { setPortionIndex(i); setCustom(false); }}
              className="min-h-11 rounded-md border border-line bg-surface px-3 text-sm font-medium aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg">
              {p.label} <span className="num opacity-70">{p.grams} {unit}</span>
            </button>
          ))}
          <button type="button" aria-pressed={custom} onClick={() => setCustom(true)}
            className="min-h-11 rounded-md border border-line bg-surface px-3 text-sm font-medium aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg">
            Custom g/ml
          </button>
        </div>
      </fieldset>
      {custom ? (
        <label className="flex items-center justify-between gap-3 text-sm text-subtle">
          Amount ({unit})
          <input
            inputMode="decimal"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            aria-invalid={!customValid}
            className="num min-h-11 w-28 rounded-md border border-line bg-surface px-3 text-right text-base text-ink outline-none focus-visible:border-accent aria-invalid:border-bad"
          />
        </label>
      ) : (
      <div className="flex items-center justify-between"><span className="text-sm text-subtle">How many?</span>
        <div className="flex items-center overflow-hidden rounded-md border border-line">
          <button type="button" className="size-11 text-xl font-bold" aria-label="Less" onClick={() => step(-1)}>−</button>
          <span className="num min-w-16 text-center font-semibold">{quantity}</span>
          <button type="button" className="size-11 text-xl font-bold" aria-label="More" onClick={() => step(1)}>+</button>
        </div>
      </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm text-subtle">Meal</span>
        <div className="flex flex-wrap gap-2">{MEALS.map((m) => (
          <button key={m} type="button" aria-pressed={m === meal} onClick={() => setMeal(m)} className="min-h-11 rounded-md border border-line bg-surface px-3 text-sm font-medium capitalize aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg">{m}</button>
        ))}</div>
      </div>
      <Button className="h-12 w-full" disabled={add.isPending || (custom ? !customValid : loggable.length === 0)} onClick={() => add.mutate()}>
        {add.isPending ? "Adding…" : <>Add to {meal} · <span className="num">{kcal}</span> kcal</>}
      </Button>
    </div>
  );
}
