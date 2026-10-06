"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import type { Meal } from "@/lib/nutrition/types";

const FIELDS = [
  { key: "energyKcal", label: "Calories (kcal)", placeholder: "350", max: 5000 },
  { key: "protein", label: "Protein (g)", placeholder: "14", max: 500 },
  { key: "carbs", label: "Carbs (g)", placeholder: "48", max: 500 },
  { key: "fat", label: "Fat (g)", placeholder: "10", max: 500 },
] as const;

export function QuickAddForm({ date, meal, onDone }: { date: string; meal: Meal; onDone?: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [values, setValues] = useState<Record<string, string>>({ energyKcal: "", protein: "", carbs: "", fat: "" });
  const [save, setSave] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function validate() {
    const trimmed = name.trim();
    if (!trimmed) return "Name it so you can find it again.";
    for (const f of FIELDS) {
      const raw = values[f.key];
      const v = raw === "" ? 0 : Number(raw);
      if (!Number.isFinite(v) || v < 0 || v > f.max) return `${f.label} should be between 0 and ${f.max}.`;
    }
    return null;
  }

  const add = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      const nutrients = {
        energyKcal: Number(values.energyKcal) || 0,
        protein: Number(values.protein) || 0,
        carbs: Number(values.carbs) || 0,
        fat: Number(values.fat) || 0,
      };
      if (save) {
        const created = await api<{ food: { id: string } }>("/api/v1/foods", {
          method: "POST",
          body: JSON.stringify({ name: trimmed, per: { amount: 1, unit: "serving" }, nutrients }),
        });
        await api("/api/v1/log", {
          method: "POST",
          body: JSON.stringify({ kind: "food", date, meal, foodId: created.food.id, portionIndex: 0, quantity: 1 }),
        });
      } else {
        await api("/api/v1/log", { method: "POST", body: JSON.stringify({ kind: "quick", date, meal, name: trimmed, nutrients }) });
      }
      return trimmed;
    },
    onSuccess: (loggedName) => {
      toast.success(`Added ${loggedName} to ${meal}.`);
      void qc.invalidateQueries({ queryKey: ["foods", "recent"] });
      router.refresh();
      onDone?.();
    },
    onError: (e) => {
      const message = e instanceof ApiError ? e.message : "Couldn't add that. Try again.";
      setError(message);
      toast.error(message);
    },
  });

  return (
    <form
      className="mt-3.5 flex flex-col gap-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        const message = validate();
        setError(message);
        if (!message) add.mutate();
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Mom's rajma"
          maxLength={120}
          className="min-h-11 rounded-md border border-line bg-surface px-3 text-base outline-none focus-visible:border-accent"
        />
      </label>
      <div className="grid grid-cols-2 gap-2.5">
        {FIELDS.map(({ key, label, placeholder }) => (
          <label key={key} className="flex flex-col gap-1.5 text-sm font-medium">
            {label}
            <input
              inputMode="decimal"
              value={values[key]}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              placeholder={placeholder}
              className="num min-h-11 rounded-md border border-line bg-surface px-3 text-base outline-none focus-visible:border-accent"
            />
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} className="size-5" />
        Save to My foods so I can search it later
      </label>
      {error && <p className="text-sm text-bad">{error}</p>}
      <Button type="submit" className="h-12 w-full" disabled={add.isPending}>
        {add.isPending ? "Adding…" : `Add to ${meal}`}
      </Button>
    </form>
  );
}
