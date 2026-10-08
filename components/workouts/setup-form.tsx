"use client";
// The Workouts hub's first-visit setup (spec "First-visit setup", workouts-layout.html ①): height,
// current weight and an optional goal weight, plus the weekly workout goal in days. "Skip for now"
// marks it done without touching any field; every answer can be changed later in Me.
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { parseAmount } from "@/lib/parse-amount";
import type { FitnessSettings } from "@/lib/fitness/types";
import { cn } from "@/lib/utils";

const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const CARD = "grid gap-3 rounded-[24px] bg-surface p-[18px] shadow-card";

function NumberField({ label, optional, value, onChange, unit, placeholder, error, ariaLabel }: {
  label: string; optional?: boolean; value: string; onChange: (v: string) => void; unit: string; placeholder: string; error: string | null; ariaLabel: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="px-1 text-[13px] font-semibold text-ink">
        {label} {optional && <span className="font-normal text-subtle">(optional)</span>}
      </span>
      <span className="flex min-h-12 items-center gap-2 rounded-[16px] bg-sunken px-4">
        <input
          inputMode="decimal"
          value={value}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
          className="num min-h-11 min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-subtle aria-invalid:text-bad"
        />
        <span className="shrink-0 text-[14px] text-subtle">{unit}</span>
      </span>
      {error && <span className="px-1 text-[12.5px] text-bad">{error}</span>}
    </label>
  );
}

type Defaults = { weeklyWorkoutGoal: number; goalWeightKg: number | null; heightCm: number | null };

export function SetupForm({ defaults }: { defaults: Defaults }) {
  const router = useRouter();
  const [heightText, setHeightText] = useState(defaults.heightCm === null ? "" : String(defaults.heightCm));
  const [weightText, setWeightText] = useState("");
  const [goalText, setGoalText] = useState(defaults.goalWeightKg === null ? "" : String(defaults.goalWeightKg));
  const [days, setDays] = useState(defaults.weeklyWorkoutGoal);

  const parsedHeight = parseAmount(heightText);
  const height = parsedHeight === null || Number.isNaN(parsedHeight) ? null : Math.round(parsedHeight);
  const heightError = heightText.trim() === "" ? null : height === null ? "Enter a number" : height < 100 || height > 250 ? "Enter 100–250 cm" : null;

  const parsedWeight = parseAmount(weightText);
  const weight = parsedWeight === null || Number.isNaN(parsedWeight) ? null : Math.round(parsedWeight * 10) / 10;
  const weightError = weightText.trim() === "" ? null : weight === null ? "Enter a number" : weight < 20 || weight > 400 ? "Enter 20–400 kg" : null;

  const parsedGoal = parseAmount(goalText);
  const goalWeight = parsedGoal === null || Number.isNaN(parsedGoal) ? null : Math.round(parsedGoal * 10) / 10;
  const goalError = goalText.trim() === "" ? null : goalWeight === null ? "Enter a number" : goalWeight < 20 || goalWeight > 400 ? "Enter 20–400 kg" : null;

  const hasError = !!heightError || !!weightError || !!goalError;

  const setup = useMutation({
    mutationFn: (body: { skip: true } | { heightCm: number | null; weightKg: number | null; goalWeightKg: number | null; weeklyWorkoutGoal: number }) =>
      api<{ fitness: FitnessSettings }>("/api/v1/me/fitness/setup", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => router.refresh(),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (hasError || setup.isPending) return;
    setup.mutate({ heightCm: height, weightKg: weight, goalWeightKg: goalWeight, weeklyWorkoutGoal: days });
  }

  return (
    <form onSubmit={submit} className="mx-auto flex w-full max-w-[480px] flex-col gap-4">
      <div className="grid gap-1 px-0.5">
        <h1 className="m-0 text-[30px] leading-[1.05] font-[650] tracking-[-0.04em] text-ink md:text-[40px]">Set up your training</h1>
        <p className="m-0 text-[14px] leading-snug text-subtle">Your weight makes calorie burn accurate. You can change these anytime in Me.</p>
      </div>

      <section className={CARD}>
        <NumberField label="Height" optional ariaLabel="Height, cm (optional)" value={heightText} onChange={setHeightText} unit="cm" placeholder="e.g. 170" error={heightError} />
        <NumberField label="Current weight" optional ariaLabel="Current weight, kg (optional)" value={weightText} onChange={setWeightText} unit="kg" placeholder="e.g. 70" error={weightError} />
        <NumberField label="Goal weight" optional ariaLabel="Goal weight, kg (optional)" value={goalText} onChange={setGoalText} unit="kg" placeholder="e.g. 65" error={goalError} />
      </section>

      <section className={CARD}>
        <span id="setup-days" className="px-1 text-[12px] font-semibold tracking-[0.06em] text-subtle uppercase">Workout days a week</span>
        <div role="group" aria-labelledby="setup-days" className="grid grid-cols-4 gap-1.5">
          {DAYS.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={days === n}
              onClick={() => setDays(n)}
              className={cn(
                "flex min-h-11 min-w-11 items-center justify-center rounded-[12px] text-[14px] font-semibold whitespace-nowrap transition-colors",
                days === n ? "bg-brand text-brand-ink" : "bg-sunken text-ink hover:bg-line",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      {setup.isError && (
        <p role="alert" className="m-0 rounded-[14px] bg-bad/12 px-3.5 py-2.5 text-[13.5px] font-semibold text-bad">
          {setup.error instanceof Error ? setup.error.message : "Couldn’t save. Try again."}
        </p>
      )}

      <Button type="submit" shape="pill" size="xl" className="h-[54px] w-full" disabled={setup.isPending || hasError}>
        <Check aria-hidden />
        {setup.isPending ? "Saving…" : "Continue"}
      </Button>
      <button
        type="button"
        onClick={() => setup.mutate({ skip: true })}
        disabled={setup.isPending}
        className="mx-auto inline-flex min-h-11 items-center justify-center px-4 text-[14px] font-semibold whitespace-nowrap text-subtle hover:text-ink disabled:opacity-50"
      >
        Skip for now
      </button>
    </form>
  );
}
