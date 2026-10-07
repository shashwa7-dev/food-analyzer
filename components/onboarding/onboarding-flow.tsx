"use client";
// First-run setup (spec §6, C1): four steps, each one card on the wash — goal, diet, allergies, daily
// targets — with lime progress dots, Back and Skip in the top bar and one primary pill per step.
// Choices are tiles with icons; the chosen one takes the meal tiles' brand-soft state.
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Bean, CandyOff, Check, ChevronDown, Droplets, Dumbbell, Egg, Fish, Flower2, Leaf, Loader2,
  Milk, Nut, Salad, Shell, Sprout, TreeDeciduous, TrendingDown, Utensils, Wheat, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { BackButton } from "@/components/nav/back-button";
import { ALL_FIELDS, MORE_FIELDS, PRIMARY_FIELDS, ProChip, TargetField, toTextRecord, type FieldKey } from "@/components/me/target-fields";
import { cn } from "@/lib/utils";
import { PRESETS, targetsFor } from "@/lib/nutrition/targets";
import { ALLERGEN_KEYS, allergensForDiet, type AllergenKey } from "@/lib/nutrition/personalise";
import type { DailyTargets, Diet, Goal } from "@/lib/nutrition/types";
import { GOALS, DIETS, ALLERGEN_LABELS } from "@/lib/profile/options";
import { parseTarget } from "@/lib/profile/parse-target";
import { saveProfile } from "@/app/(app)/me/actions";

const STEPS = [
  { title: "What's your goal?", hint: "It sets your daily targets. You can change it later in Me." },
  { title: "Any diet to match?", hint: "We flag foods that don't fit it when you scan or add them." },
  { title: "Anything to avoid?", hint: "Pick any allergies. Foods that contain them get a warning." },
  { title: "Your daily targets", hint: "Set from your goal. Change them now or any time in Me." },
] as const;

const GOAL_ICON: Record<Goal, LucideIcon> = {
  general: Salad, weight_loss: TrendingDown, muscle: Dumbbell, low_sugar: CandyOff, low_sodium: Droplets,
};
const DIET_ICON: Record<Diet, LucideIcon> = {
  none: Utensils, vegetarian: Leaf, eggetarian: Egg, vegan: Sprout, jain: Flower2,
};
const ALLERGEN_ICON: Record<AllergenKey, LucideIcon> = {
  peanut: Nut, tree_nut: TreeDeciduous, milk: Milk, egg: Egg, gluten: Wheat,
  soy: Bean, sesame: Sprout, fish: Fish, shellfish: Shell, mustard: Leaf,
};

export interface OnboardingInitial {
  goal: Goal;
  diet: Diet;
  allergies: string[];
  targets: Partial<DailyTargets> | null;
}

/**
 * A selectable tile: an icon, a title and an optional line; brand-soft with a lime border when chosen.
 * A multi-select tile (checkbox) also swaps its icon for a check on an ink tile, so "picked" doesn't
 * rest on colour alone.
 */
function ChoiceTile({ icon: Icon, title, desc, on, role, onClick, className }: {
  icon: LucideIcon; title: string; desc?: string; on: boolean; role: "radio" | "checkbox"; onClick: () => void; className?: string;
}) {
  const checked = role === "checkbox" && on;
  return (
    <button
      type="button"
      role={role}
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "flex min-h-[60px] min-w-0 items-center gap-3 rounded-[18px] border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:bg-sunken/60",
        on && "border-brand bg-brand-soft hover:bg-brand-soft",
        className,
      )}
    >
      <IconTile tone={on ? "brand" : "neutral"} className={cn(on && "bg-surface", checked && "bg-action text-action-ink")}>
        {checked ? <Check strokeWidth={2.5} /> : <Icon />}
      </IconTile>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[15px] font-semibold text-ink">{title}</span>
        {desc && <span className="block truncate text-[12.5px] text-subtle">{desc}</span>}
      </span>
    </button>
  );
}

function Dots({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      {STEPS.map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-2 rounded-full transition-[width,background-color] motion-reduce:transition-none",
            i === step ? "w-6 bg-brand" : i < step ? "w-2 bg-brand" : "w-2 bg-line",
          )}
        />
      ))}
    </div>
  );
}

function StepCard({ step, children }: { step: number; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-[24px] bg-surface p-[18px] shadow-card md:p-6" aria-labelledby="onboarding-title">
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold tracking-[0.06em] text-subtle uppercase">Step {step + 1} of {STEPS.length}</span>
        <h1 id="onboarding-title" className="title m-0 text-[30px] font-[650] tracking-[-0.04em] text-ink">{STEPS[step].title}</h1>
        <p className="m-0 text-[14px] leading-snug text-subtle">{STEPS[step].hint}</p>
      </div>
      {children}
    </section>
  );
}

/**
 * `customTargets` false (Pro gate on, Basic plan): the targets step shows the goal's presets read-only.
 * `redo` (from Me → Set up again): step 1's Back returns to Me instead of being hidden.
 */
export function OnboardingFlow({ initial, customTargets = true, redo = false }: {
  initial: OnboardingInitial; customTargets?: boolean; redo?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal>(initial.goal);
  const [diet, setDiet] = useState<Diet>(initial.diet);
  const [allergies, setAllergies] = useState<Set<AllergenKey>>(
    () => new Set(initial.allergies.filter((a): a is AllergenKey => (ALLERGEN_KEYS as readonly string[]).includes(a))),
  );
  const [fields, setFields] = useState<Record<FieldKey, string> | null>(null);
  const [edited, setEdited] = useState<Set<FieldKey>>(() => new Set());
  const [invalid, setInvalid] = useState<Set<FieldKey>>(() => new Set());
  const [showAll, setShowAll] = useState(false);
  const [pending, setPending] = useState(false);

  /** Entering the targets step: fields the user hasn't typed in follow the goal picked now. */
  function prepareFields() {
    const preset = toTextRecord(targetsFor(goal, initial.targets));
    setFields((cur) => {
      if (!cur) return preset;
      const out = { ...cur };
      for (const f of ALL_FIELDS) if (!edited.has(f.key)) out[f.key] = preset[f.key];
      return out;
    });
  }

  function setField(key: FieldKey, v: string) {
    setFields((cur) => (cur ? { ...cur, [key]: v } : cur));
    setEdited((cur) => new Set(cur).add(key));
    setInvalid((cur) => {
      if (!cur.has(key)) return cur;
      const next = new Set(cur);
      next.delete(key);
      return next;
    });
  }

  /** Targets stored only where they differ from the goal's preset; undefined when a field doesn't parse. */
  function buildTargetsOverride(): Partial<DailyTargets> | null | undefined {
    if (!fields || !customTargets) return initial.targets ?? null;
    const preset = PRESETS[goal];
    const out: Partial<DailyTargets> = {};
    const bad = new Set<FieldKey>();
    for (const f of ALL_FIELDS) {
      const v = parseTarget(fields[f.key]);
      if (v === null) continue;
      if (Number.isNaN(v)) bad.add(f.key);
      else if (v !== preset[f.key]) (out as Record<string, number>)[f.key] = v;
    }
    if (bad.size) {
      setInvalid(bad);
      // An error in a hidden field must be visible.
      if (MORE_FIELDS.some((f) => bad.has(f.key))) setShowAll(true);
      return undefined;
    }
    return Object.keys(out).length ? out : null;
  }

  async function finish() {
    const targets = buildTargetsOverride();
    if (targets === undefined) {
      setStep(3);
      return;
    }
    setPending(true);
    const res = await saveProfile({ goal, diet, allergies: Array.from(allergies), targets, onboarded: true })
      .catch(() => ({ ok: false as const, message: "Couldn't save. Try again." }));
    if (!res.ok) {
      toast.error(res.message);
      setPending(false);
      return;
    }
    router.replace("/today");
  }

  function pickDiet(key: Diet) {
    setDiet(key);
    const allowed = new Set(allergensForDiet(key));
    setAllergies((prev) => new Set(Array.from(prev).filter((a) => allowed.has(a))));
  }

  function toggleAllergy(key: AllergenKey) {
    setAllergies((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function continueStep() {
    if (step === 2) prepareFields();
    if (step < 3) setStep((s) => s + 1);
    else void finish();
  }

  const last = step === STEPS.length - 1;
  const roundBtn = "grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink transition-colors hover:bg-sunken";

  return (
    <div data-no-phone-nav data-onboarding className="mx-auto flex w-full max-w-[560px] flex-col gap-4 md:pt-6">
      <div className="flex items-center justify-between gap-2.5">
        {step > 0 ? (
          <button type="button" onClick={() => setStep((s) => s - 1)} aria-label="Previous step" className={roundBtn} disabled={pending}>
            <ArrowLeft className="size-5" aria-hidden />
          </button>
        ) : redo ? (
          <BackButton fallback="/me" />
        ) : (
          <span className="size-11 shrink-0" aria-hidden />
        )}
        <Dots step={step} />
        <button
          type="button"
          onClick={() => void finish()}
          disabled={pending}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full px-3 text-[14px] font-semibold whitespace-nowrap text-subtle hover:bg-sunken hover:text-ink disabled:opacity-50"
        >
          Skip
        </button>
      </div>

      <StepCard step={step}>
        {step === 0 && (
          <div role="radiogroup" aria-label="Goal" className="grid gap-2 sm:grid-cols-2">
            {GOALS.map(([key, title, desc]) => (
              <ChoiceTile key={key} role="radio" icon={GOAL_ICON[key]} title={title} desc={desc} on={goal === key} onClick={() => setGoal(key)} />
            ))}
          </div>
        )}

        {step === 1 && (
          <div role="radiogroup" aria-label="Diet" className="grid grid-cols-2 gap-2">
            {DIETS.map(([key, label]) => (
              <ChoiceTile
                key={key}
                role="radio"
                icon={DIET_ICON[key]}
                title={label}
                on={diet === key}
                onClick={() => pickDiet(key)}
                className={key === "none" ? "col-span-2" : undefined}
              />
            ))}
          </div>
        )}

        {step === 2 && (
          <div role="group" aria-label="Allergies" className="grid grid-cols-2 gap-2">
            {allergensForDiet(diet).map((key) => (
              <ChoiceTile
                key={key}
                role="checkbox"
                icon={ALLERGEN_ICON[key]}
                title={ALLERGEN_LABELS[key]}
                on={allergies.has(key)}
                onClick={() => toggleAllergy(key)}
              />
            ))}
          </div>
        )}

        {step === 3 && fields && (
          <div className="flex flex-col gap-3">
            {!customTargets && (
              <div className="flex items-center justify-between gap-2 rounded-[14px] bg-sunken py-1 pr-1.5 pl-3">
                <span className="text-[13px] text-subtle">Your goal&apos;s targets</span>
                <ProChip>Custom targets</ProChip>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              {(showAll ? ALL_FIELDS : PRIMARY_FIELDS).map((f) => (
                <TargetField
                  key={f.key}
                  label={f.label}
                  unit={f.unit}
                  value={fields[f.key]}
                  error={invalid.has(f.key)}
                  readOnly={!customTargets}
                  onChange={(v) => setField(f.key, v)}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowAll((s) => !s)}
              aria-expanded={showAll}
              className="-my-1.5 inline-flex min-h-11 items-center gap-1 self-start rounded-full px-1 text-[13px] font-semibold whitespace-nowrap text-brand-deep"
            >
              {showAll ? "Fewer targets" : "All targets"}
              <ChevronDown className={cn("size-4 transition-transform motion-reduce:transition-none", showAll && "rotate-180")} aria-hidden />
            </button>
          </div>
        )}
      </StepCard>

      <div className="sticky bottom-0 z-10 -mx-4 bg-[linear-gradient(180deg,transparent,var(--bg)_30%)] px-4 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))] md:static md:mx-0 md:bg-none md:p-0">
        <Button type="button" shape="pill" size="xl" className="h-[54px] w-full" disabled={pending} onClick={continueStep}>
          {pending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : last && <Check aria-hidden />}
          {pending ? "Saving…" : last ? "Start tracking" : "Continue"}
          {!pending && !last && <ArrowRight data-icon="inline-end" aria-hidden />}
        </Button>
      </div>
    </div>
  );
}
