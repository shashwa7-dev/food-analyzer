"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AmountStepper } from "@/components/food/amount-stepper";
import { SheetActions } from "@/components/me/settings-form";
import { api } from "@/lib/api-client";
import { DECIMAL_COMMA_MESSAGE, parseAmount } from "@/lib/parse-amount";
import { fmtWeight } from "@/lib/fitness/weight-view";
import type { FitnessSettings } from "@/lib/fitness/types";

/** "5 days a week · goal 70 kg" for the Me row. */
export const fitnessValue = (f: FitnessSettings) =>
  `${f.weeklyWorkoutGoal} ${f.weeklyWorkoutGoal === 1 ? "day" : "days"} a week${f.goalWeightKg !== null ? ` · ${fmtWeight(f.goalWeightKg)} kg` : ""}`;

/**
 * The Fitness sheet (spec §C screen 8): the weekly goal in workout days (1–7) and an optional goal
 * weight (20–400 kg, "70,5" allowed; empty clears it). Saves through PATCH /api/v1/me/fitness.
 */
export function FitnessSection({ fitness, onDone }: { fitness: FitnessSettings; onDone: () => void }) {
  const router = useRouter();
  const [days, setDays] = useState(fitness.weeklyWorkoutGoal);
  const [text, setText] = useState(fitness.goalWeightKg === null ? "" : fmtWeight(fitness.goalWeightKg));
  const parsed = parseAmount(text);
  const goal = parsed === null || Number.isNaN(parsed) ? null : Math.round(parsed * 10) / 10;
  const error = text.trim() === "" ? null
    : /^\d+,\d{2}$/.test(text.replace(/\s/g, "")) ? DECIMAL_COMMA_MESSAGE
    : goal === null ? "Enter a number"
    : goal < 20 || goal > 400 ? "Enter 20–400 kg" : null;
  const dirty = days !== fitness.weeklyWorkoutGoal || goal !== fitness.goalWeightKg;

  const save = useMutation({
    mutationFn: () => api<{ fitness: FitnessSettings }>("/api/v1/me/fitness", { method: "PATCH", body: JSON.stringify({ weeklyWorkoutGoal: days, goalWeightKg: goal }) }),
    onSuccess: () => {
      toast.success("Fitness goals saved");
      onDone();
      router.refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn’t save that. Try again."),
  });

  return (
    <>
      <div className="grid gap-1.5">
        <span className="px-1 text-[13px] font-semibold text-ink" id="fit-days">Weekly goal</span>
        <div role="group" aria-labelledby="fit-days">
          <AmountStepper
            amount={days}
            sub={days === 1 ? "workout day a week" : "workout days a week"}
            onStep={(dir) => setDays((d) => Math.min(7, Math.max(1, d + dir)))}
            canDecrease={days > 1}
            canIncrease={days < 7}
          />
        </div>
      </div>
      <label className="grid gap-1.5">
        <span className="px-1 text-[13px] font-semibold text-ink">Goal weight <span className="font-normal text-subtle">(optional)</span></span>
        <span className="flex min-h-12 items-center gap-2 rounded-[16px] bg-surface px-4 shadow-card">
          <input
            inputMode="decimal"
            value={text}
            placeholder="e.g. 70"
            aria-label="Goal weight, kg (optional)"
            aria-invalid={!!error}
            onChange={(e) => setText(e.target.value)}
            className="num min-h-11 min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-subtle aria-invalid:text-bad"
          />
          <span className="shrink-0 text-[14px] text-subtle">kg</span>
        </span>
        <span className="min-h-[18px] truncate px-1 text-[12.5px] text-subtle">
          {error ? <span className="text-bad">{error}</span> : "Drawn as a line on your weight chart."}
        </span>
      </label>
      <SheetActions pending={save.isPending} dirty={dirty && !error} onCancel={onDone} onSave={() => save.mutate()} />
    </>
  );
}
