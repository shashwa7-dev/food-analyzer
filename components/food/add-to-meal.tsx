"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { MEALS, type Meal, type Nutrients, type Portion } from "@/lib/nutrition/types";

export function AddToMeal({ food, date, defaultMeal, onDone }: {
  food: { id: string; name: string; per100: Nutrients; portions: Portion[]; defaultPortion: number; basis: "per_100g" | "per_100ml" };
  date: string; defaultMeal: Meal; onDone?: () => void;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const loggable = food.portions.map((p, i) => ({ p, i })).filter(({ p }) => p.grams);
  const [portionIndex, setPortionIndex] = useState(loggable.find(({ i }) => i === food.defaultPortion)?.i ?? loggable[0]?.i ?? 0);
  const [quantity, setQuantity] = useState(1);
  const [meal, setMeal] = useState<Meal>(defaultMeal);
  const grams = (food.portions[portionIndex]?.grams ?? 0) * quantity;
  const kcal = Math.round((food.per100.energyKcal * grams) / 100);
  const unit = food.basis === "per_100ml" ? "ml" : "g";
  const step = (dir: 1 | -1) => setQuantity((q) => Math.max(0.25, Math.min(20, q <= 0.5 ? (dir > 0 ? q * 2 : q / 2) : q < 1 || (q === 1 && dir < 0) ? q + dir * 0.5 : q + dir)));
  const add = useMutation({
    mutationFn: () => api("/api/v1/log", { method: "POST", body: JSON.stringify({ kind: "food", date, meal, foodId: food.id, portionIndex, quantity }) }),
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
            <button key={p.label} type="button" aria-pressed={i === portionIndex} onClick={() => setPortionIndex(i)}
              className="min-h-11 rounded-md border border-line bg-surface px-3 text-sm font-medium aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg">
              {p.label} <span className="num opacity-70">{p.grams} {unit}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center justify-between"><span className="text-sm text-subtle">How many?</span>
        <div className="flex items-center overflow-hidden rounded-md border border-line">
          <button type="button" className="size-11 text-xl font-bold" aria-label="Less" onClick={() => step(-1)}>−</button>
          <span className="num min-w-16 text-center font-semibold">{quantity}</span>
          <button type="button" className="size-11 text-xl font-bold" aria-label="More" onClick={() => step(1)}>+</button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm text-subtle">Meal</span>
        <div className="flex flex-wrap gap-2">{MEALS.map((m) => (
          <button key={m} type="button" aria-pressed={m === meal} onClick={() => setMeal(m)} className="min-h-11 rounded-md border border-line bg-surface px-3 text-sm font-medium capitalize aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg">{m}</button>
        ))}</div>
      </div>
      <Button className="h-12 w-full" disabled={add.isPending || loggable.length === 0} onClick={() => add.mutate()}>
        {add.isPending ? "Adding…" : <>Add to {meal} · <span className="num">{kcal}</span> kcal</>}
      </Button>
    </div>
  );
}
