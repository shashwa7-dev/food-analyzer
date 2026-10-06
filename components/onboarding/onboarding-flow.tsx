"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PRESETS } from "@/lib/nutrition/targets";
import { ALLERGEN_KEYS, type AllergenKey } from "@/lib/nutrition/personalise";
import type { DailyTargets, Diet, Goal } from "@/lib/nutrition/types";
import { saveProfile } from "@/app/(app)/me/actions";

const GOALS: [Goal, string, string][] = [
  ["general", "Eat better", "Balanced targets, honest grades"],
  ["weight_loss", "Lose weight", "Lower calorie target"],
  ["muscle", "Build muscle", "Higher protein target"],
  ["low_sugar", "Cut sugar", "Sugar limit 25 g"],
  ["low_sodium", "Cut salt", "Sodium limit 1,500 mg"],
];
const DIETS: [Diet, string][] = [
  ["none", "No restriction"],
  ["vegetarian", "Vegetarian"],
  ["eggetarian", "Eggetarian"],
  ["vegan", "Vegan"],
  ["jain", "Jain"],
];
const ALLERGEN_LABELS: Record<AllergenKey, string> = {
  peanut: "Peanut", tree_nut: "Tree nuts", milk: "Milk", egg: "Egg", gluten: "Gluten",
  soy: "Soy", sesame: "Sesame", fish: "Fish", shellfish: "Shellfish", mustard: "Mustard",
};
const PRIMARY_FIELDS = [
  { key: "energyKcal", label: "Calories (kcal)", min: 800, max: 6000 },
  { key: "protein", label: "Protein (g)", min: 10, max: 400 },
] as const;
const MORE_FIELDS = [
  { key: "carbs", label: "Carbs (g)", min: 20, max: 800 },
  { key: "fat", label: "Fat (g)", min: 10, max: 300 },
  { key: "fibre", label: "Fibre (g)", min: 5, max: 100 },
  { key: "sugarsMax", label: "Sugar limit (g)", min: 5, max: 300 },
  { key: "sodiumMgMax", label: "Sodium limit (mg)", min: 200, max: 6000 },
  { key: "satFatMax", label: "Saturated fat limit (g)", min: 5, max: 100 },
] as const;
const ALL_FIELDS = [...PRIMARY_FIELDS, ...MORE_FIELDS];
type FieldKey = (typeof ALL_FIELDS)[number]["key"];

const STEP_TITLES = ["What's your goal?", "Any diet to match?", "Anything to avoid?", "Your daily targets"];

export interface OnboardingInitial {
  goal: Goal;
  diet: Diet;
  allergies: string[];
  targets: Partial<DailyTargets> | null;
}

function toTextRecord(preset: DailyTargets): Record<FieldKey, string> {
  const out = {} as Record<FieldKey, string>;
  for (const f of ALL_FIELDS) out[f.key] = String(preset[f.key]);
  return out;
}

export function OnboardingFlow({ initial }: { initial: OnboardingInitial }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal>(initial.goal);
  const [diet, setDiet] = useState<Diet>(initial.diet);
  const [allergies, setAllergies] = useState<Set<AllergenKey>>(
    () => new Set(initial.allergies.filter((a): a is AllergenKey => (ALLERGEN_KEYS as readonly string[]).includes(a))),
  );
  const [fields, setFields] = useState<Partial<Record<FieldKey, string>>>({});
  const [fieldsReady, setFieldsReady] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [pending, setPending] = useState(false);

  function ensureFieldsReady() {
    if (fieldsReady) return;
    const preset: DailyTargets = { ...PRESETS[goal], ...(initial.targets ?? {}) };
    setFields(toTextRecord(preset));
    setFieldsReady(true);
  }

  function buildTargetsOverride(): Partial<DailyTargets> | null {
    if (!fieldsReady) return initial.targets ?? null;
    const preset = PRESETS[goal];
    const out: Partial<DailyTargets> = {};
    for (const f of ALL_FIELDS) {
      const raw = fields[f.key];
      if (raw === undefined || raw === "") continue;
      const v = Number(raw);
      if (!Number.isFinite(v)) continue;
      if (v !== preset[f.key]) (out as Record<string, number>)[f.key] = v;
    }
    return Object.keys(out).length ? out : null;
  }

  async function finish() {
    setPending(true);
    const res = await saveProfile({
      goal,
      diet,
      allergies: Array.from(allergies),
      targets: buildTargetsOverride(),
      onboarded: true,
    });
    if (!res.ok) {
      toast.error(res.message);
      setPending(false);
      return;
    }
    router.replace("/today");
  }

  function continueStep() {
    if (step === 2) ensureFieldsReady();
    if (step < 3) setStep((s) => s + 1);
    else void finish();
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="text-sm text-subtle">Step {step + 1} of 4</div>
      <h1 className="title mb-4 text-[22px]">{STEP_TITLES[step]}</h1>
      <div className="mb-5 flex gap-1.5" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-accent" : "bg-line")} />
        ))}
      </div>

      {step === 0 && (
        <div className="grid grid-cols-2 gap-2.5">
          {GOALS.map(([key, title, desc]) => (
            <button
              key={key}
              type="button"
              aria-pressed={goal === key}
              onClick={() => setGoal(key)}
              className="group flex min-h-[72px] flex-col gap-0.5 rounded-lg border border-line bg-surface p-3 text-left aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg"
            >
              <span className="text-[15px] font-semibold">{title}</span>
              <span className="text-xs text-subtle group-aria-pressed:text-bg/70">{desc}</span>
            </button>
          ))}
        </div>
      )}

      {step === 1 && (
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Diet</legend>
          {DIETS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={diet === key}
              onClick={() => setDiet(key)}
              className="min-h-11 rounded-md border border-line bg-surface px-3.5 text-sm font-medium aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg"
            >
              {label}
            </button>
          ))}
        </fieldset>
      )}

      {step === 2 && (
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Allergies</legend>
          {ALLERGEN_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={allergies.has(key)}
              onClick={() =>
                setAllergies((prev) => {
                  const next = new Set(prev);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                })
              }
              className="min-h-11 rounded-md border border-line bg-surface px-3.5 text-sm font-medium aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg"
            >
              {ALLERGEN_LABELS[key]}
            </button>
          ))}
        </fieldset>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            {PRIMARY_FIELDS.map((f) => (
              <label key={f.key} className="flex flex-col gap-1.5 text-sm font-medium">
                {f.label}
                <input
                  inputMode="decimal"
                  value={fields[f.key] ?? ""}
                  onChange={(e) => setFields((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="num min-h-11 rounded-md border border-line bg-surface px-3 text-base outline-none focus-visible:border-accent"
                />
              </label>
            ))}
          </div>
          <button type="button" onClick={() => setShowAll((s) => !s)} className="self-start text-sm font-semibold text-accent underline-offset-2 hover:underline">
            {showAll ? "Hide other targets" : "Show all targets"}
          </button>
          {showAll && (
            <div className="grid grid-cols-2 gap-3">
              {MORE_FIELDS.map((f) => (
                <label key={f.key} className="flex flex-col gap-1.5 text-sm font-medium">
                  {f.label}
                  <input
                    inputMode="decimal"
                    value={fields[f.key] ?? ""}
                    onChange={(e) => setFields((v) => ({ ...v, [f.key]: e.target.value }))}
                    className="num min-h-11 rounded-md border border-line bg-surface px-3 text-base outline-none focus-visible:border-accent"
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex gap-2.5">
        <Button type="button" variant="outline" className="h-12" disabled={pending} onClick={() => void finish()}>
          Skip
        </Button>
        <Button type="button" className="h-12 flex-1" disabled={pending} onClick={continueStep}>
          {pending ? "Saving…" : step < 3 ? "Continue" : "Start tracking"}
        </Button>
      </div>
    </div>
  );
}
