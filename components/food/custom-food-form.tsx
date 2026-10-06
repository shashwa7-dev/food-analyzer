"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import type { Nutrients } from "@/lib/nutrition/types";

export interface CustomFoodFormInitial {
  id: string;
  name: string;
  brand: string;
  per: { amount: number; unit: "g" | "ml" | "serving" };
  servingGrams?: number;
  nutrients: Nutrients;
}

type Unit = "g" | "ml" | "serving";
const UNIT_LABEL: Record<Unit, string> = { serving: "1 serving", g: "100 g", ml: "100 ml" };

const REQUIRED_FIELDS = [
  { key: "energyKcal", label: "Calories (kcal)", max: 5000 },
  { key: "protein", label: "Protein (g)", max: 500 },
  { key: "carbs", label: "Carbs (g)", max: 500 },
  { key: "fat", label: "Fat (g)", max: 500 },
] as const;
const OPTIONAL_FIELDS = [
  { key: "sugars", label: "Sugars (g)", max: 500 },
  { key: "satFat", label: "Saturated fat (g)", max: 500 },
  { key: "fibre", label: "Fibre (g)", max: 500 },
  { key: "sodiumMg", label: "Sodium (mg)", max: 20000 },
] as const;

function toText(v: number | undefined): string {
  return v === undefined ? "" : String(v);
}

export function CustomFoodForm({ initial }: { initial: CustomFoodFormInitial | null }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [unit, setUnit] = useState<Unit>(initial?.per.unit ?? "g");
  const [servingGrams, setServingGrams] = useState(toText(initial?.servingGrams));
  const [values, setValues] = useState<Record<string, string>>(() => {
    const n = initial?.nutrients;
    return {
      energyKcal: toText(n?.energyKcal),
      protein: toText(n?.protein),
      carbs: toText(n?.carbs),
      fat: toText(n?.fat),
      sugars: toText(n?.sugars),
      satFat: toText(n?.satFat),
      fibre: toText(n?.fibre),
      sodiumMg: toText(n?.sodiumMg),
    };
  });
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    if (!name.trim()) return "Give it a name.";
    if (unit === "serving") {
      const g = Number(servingGrams);
      if (!(g >= 1 && g <= 2000)) return "Serving size should be between 1 and 2000 g.";
    }
    for (const f of REQUIRED_FIELDS) {
      const v = Number(values[f.key]);
      if (!Number.isFinite(v) || v < 0 || v > f.max) return `${f.label} should be between 0 and ${f.max}.`;
    }
    for (const f of OPTIONAL_FIELDS) {
      const raw = values[f.key];
      if (raw === "") continue;
      const v = Number(raw);
      if (!Number.isFinite(v) || v < 0 || v > f.max) return `${f.label} should be between 0 and ${f.max}.`;
    }
    return null;
  }

  const save = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      const trimmedBrand = brand.trim();
      const nutrients: Record<string, number> = {
        energyKcal: Number(values.energyKcal),
        protein: Number(values.protein),
        carbs: Number(values.carbs),
        fat: Number(values.fat),
      };
      for (const f of OPTIONAL_FIELDS) {
        if (values[f.key] !== "") nutrients[f.key] = Number(values[f.key]);
      }
      const body = {
        name: trimmed,
        ...(trimmedBrand ? { brand: trimmedBrand } : {}),
        per: unit === "serving" ? { amount: 1, unit: "serving" as const } : { amount: 100, unit },
        ...(unit === "serving" ? { servingGrams: Number(servingGrams) } : {}),
        nutrients,
      };
      return initial
        ? api<{ food: { id: string } }>(`/api/v1/foods/${initial.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : api<{ food: { id: string } }>("/api/v1/foods", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: (res) => {
      toast.success("Saved to My foods.");
      router.push(`/foods/${res.food.id}`);
    },
    onError: (e) => {
      const message = e instanceof ApiError ? e.message : "Couldn't save that. Try again.";
      setError(message);
      toast.error(message);
    },
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const message = validate();
        setError(message);
        if (!message) save.mutate();
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          className="min-h-11 rounded-md border border-line bg-surface px-3 text-base outline-none focus-visible:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Brand (optional)
        <input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          maxLength={80}
          className="min-h-11 rounded-md border border-line bg-surface px-3 text-base outline-none focus-visible:border-accent"
        />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Nutrition is for</legend>
        <div className="flex flex-wrap gap-2">
          {(["serving", "g", "ml"] as const).map((u) => (
            <button
              key={u}
              type="button"
              aria-pressed={unit === u}
              onClick={() => setUnit(u)}
              className="min-h-11 rounded-md border border-line bg-surface px-3 text-sm font-medium aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg"
            >
              {UNIT_LABEL[u]}
            </button>
          ))}
        </div>
      </fieldset>
      {unit === "serving" && (
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Serving size (g)
          <input
            inputMode="decimal"
            value={servingGrams}
            onChange={(e) => setServingGrams(e.target.value)}
            className="num min-h-11 rounded-md border border-line bg-surface px-3 text-base outline-none focus-visible:border-accent"
          />
        </label>
      )}
      <div className="grid grid-cols-2 gap-3">
        {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map((f) => (
          <label key={f.key} className="flex flex-col gap-1.5 text-sm font-medium">
            {f.label}
            <input
              inputMode="decimal"
              value={values[f.key]}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className="num min-h-11 rounded-md border border-line bg-surface px-3 text-base outline-none focus-visible:border-accent"
            />
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-bad">{error}</p>}
      <Button type="submit" className="h-12 w-full" disabled={save.isPending}>
        {save.isPending ? "Saving…" : initial ? "Save changes" : "Save to My foods"}
      </Button>
    </form>
  );
}
