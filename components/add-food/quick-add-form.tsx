"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Zap } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { MEAL_META } from "@/components/food/meal-meta";
import { useLogEntry } from "@/components/food/use-log-entry";
import type { Meal } from "@/lib/nutrition/types";
import { DECIMAL_COMMA_MESSAGE, amountError, parseAmount } from "@/lib/parse-amount";

const FIELDS = [
  { key: "energyKcal", label: "Calories (kcal)", placeholder: "350", max: 5000 },
  { key: "protein", label: "Protein (g)", placeholder: "14", max: 500 },
  { key: "carbs", label: "Carbs (g)", placeholder: "48", max: 500 },
  { key: "fat", label: "Fat (g)", placeholder: "10", max: 500 },
] as const;

const EMPTY = { energyKcal: "", protein: "", carbs: "", fat: "" };
const INPUT = "min-h-12 rounded-2xl border-0 bg-sunken px-4 text-base text-ink outline-none! placeholder:text-subtle/70 focus-visible:ring-2 focus-visible:ring-brand-deep";

/**
 * Quick add (M1): a name and macros, logged as one serving — saved to My foods first when the box is
 * ticked, so it's searchable next time. Ghost inputs and the primary pill (mock-c1); the add toast
 * offers Undo like every other add. The form clears after a successful add.
 */
export function QuickAddForm({ date, meal, onDone }: { date: string; meal: Meal; onDone?: () => void }) {
  const qc = useQueryClient();
  const logEntry = useLogEntry();
  const [name, setName] = useState("");
  const [values, setValues] = useState<Record<string, string>>(EMPTY);
  const [save, setSave] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function validate() {
    const trimmed = name.trim();
    if (!trimmed) return "Name it so you can find it again.";
    if (values.energyKcal!.trim() === "") return "Enter the calories.";
    for (const f of FIELDS) {
      const raw = values[f.key]!;
      if (amountError(raw) === DECIMAL_COMMA_MESSAGE) return `${f.label}: ${DECIMAL_COMMA_MESSAGE}.`;
      const v = parseAmount(raw) ?? 0;
      if (!Number.isFinite(v) || v < 0 || v > f.max) return `${f.label} should be between 0 and ${f.max}.`;
    }
    return null;
  }

  async function add() {
    const trimmed = name.trim();
    const nutrients = {
      energyKcal: parseAmount(values.energyKcal!) || 0,
      protein: parseAmount(values.protein!) || 0,
      carbs: parseAmount(values.carbs!) || 0,
      fat: parseAmount(values.fat!) || 0,
    };
    setPending(true);
    let body: Record<string, unknown> = { kind: "quick", date, meal, name: trimmed, nutrients };
    if (save) {
      try {
        const created = await api<{ food: { id: string } }>("/api/v1/foods", {
          method: "POST",
          body: JSON.stringify({ name: trimmed, per: { amount: 1, unit: "serving" }, nutrients }),
        });
        void qc.invalidateQueries({ queryKey: ["foods", "mine"] });
        body = { kind: "food", date, meal, foodId: created.food.id, portionIndex: 0, quantity: 1 };
      } catch (e) {
        const message = e instanceof ApiError ? e.message : "Couldn't save that. Try again.";
        setError(message);
        toast.error(message);
        setPending(false);
        return;
      }
    }
    const id = await logEntry(body, { name: trimmed, meal });
    setPending(false);
    if (!id) return;
    setName("");
    setValues(EMPTY);
    setError(null);
    onDone?.();
  }

  return (
    <form
      className="flex flex-col gap-3.5 rounded-[22px] bg-surface p-4 shadow-card"
      onSubmit={(e) => {
        e.preventDefault();
        const message = validate();
        setError(message);
        if (!message) void add();
      }}
    >
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-subtle">
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mom's rajma" maxLength={120} className={INPUT} />
      </label>
      <div className="grid grid-cols-2 gap-2.5">
        {FIELDS.map(({ key, label, placeholder }) => (
          <label key={key} className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold whitespace-nowrap text-subtle">
            {label}
            <input
              inputMode="decimal"
              value={values[key]}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              placeholder={placeholder}
              className={`num min-w-0 ${INPUT}`}
            />
          </label>
        ))}
      </div>
      <label className="flex min-h-11 items-center gap-2.5 text-sm text-ink">
        <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} className="size-5 shrink-0 accent-brand-deep" />
        Save to My foods so I can search it later
      </label>
      {error && <p className="m-0 text-sm text-bad" role="alert">{error}</p>}
      <Button type="submit" shape="pill" size="xl" className="h-[54px] w-full" disabled={pending}>
        {pending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Zap aria-hidden />}
        {pending ? "Adding…" : `Add to ${MEAL_META[meal].label}`}
      </Button>
    </form>
  );
}
