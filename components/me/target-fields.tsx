"use client";
// The daily-target inputs shared by the Me goal sheet and onboarding's targets step: the field list,
// one labelled input with its unit. The Pro chip shown while custom targets are Pro-only is components/pro/pro-chip.tsx.
import { useId } from "react";
import { cn } from "@/lib/utils";
import type { DailyTargets } from "@/lib/nutrition/types";
import { amountError } from "@/lib/parse-amount";

export const PRIMARY_FIELDS = [
  { key: "energyKcal", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
] as const;
export const MORE_FIELDS = [
  { key: "carbs", label: "Carbs", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
  { key: "fibre", label: "Fibre", unit: "g" },
  { key: "sugarsMax", label: "Sugar limit", unit: "g" },
  { key: "sodiumMgMax", label: "Sodium limit", unit: "mg" },
  { key: "satFatMax", label: "Sat. fat limit", unit: "g" },
] as const;
export const ALL_FIELDS = [...PRIMARY_FIELDS, ...MORE_FIELDS];
export type FieldKey = (typeof ALL_FIELDS)[number]["key"];

export function toTextRecord(t: DailyTargets): Record<FieldKey, string> {
  const out = {} as Record<FieldKey, string>;
  for (const f of ALL_FIELDS) out[f.key] = String(t[f.key]);
  return out;
}

/** `onLocked`: what tapping a read-only (Pro-locked) field does instead, i.e. open the upgrade sheet. */
export function TargetField({ label, unit, value, error, readOnly, onChange, onLocked }: {
  label: string; unit: string; value: string; error: boolean; readOnly: boolean; onChange: (v: string) => void; onLocked?: () => void;
}) {
  const errorId = useId();
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="truncate px-1 text-[13px] font-medium text-subtle">{label}</span>
      <span className={cn(
        "flex h-[52px] items-center gap-2 rounded-2xl border px-3.5 focus-within:ring-2",
        readOnly ? "bg-sunken" : "bg-surface",
        error ? "border-bad focus-within:ring-bad" : "border-line focus-within:ring-brand-deep",
      )}>
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} (${unit})`}
          aria-invalid={error || undefined}
          readOnly={readOnly}
          onClick={readOnly ? onLocked : undefined}
          aria-describedby={error ? errorId : undefined}
          className="num h-full w-full min-w-0 bg-transparent text-base font-semibold text-ink outline-none!"
        />
        <span className="shrink-0 text-[13px] text-subtle">{unit}</span>
      </span>
      {error && <span id={errorId} className="px-1 text-[12.5px] font-medium text-bad">{amountError(value) ?? "Enter a number"}</span>}
    </label>
  );
}
