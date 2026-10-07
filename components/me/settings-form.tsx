"use client";
// The Me page's settings, one section per sheet (spec §6.13): Goal (with the daily targets), Diet,
// Allergies and Country. Every section saves through the same server action (saveProfile), then
// refreshes the page so the settings list shows the stored values.
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PRESETS, targetsFor } from "@/lib/nutrition/targets";
import { allergensForDiet, ALLERGEN_KEYS, type AllergenKey } from "@/lib/nutrition/personalise";
import type { DailyTargets, Diet, Goal } from "@/lib/nutrition/types";
import { GOALS, DIETS, ALLERGEN_LABELS } from "@/lib/profile/options";
import { saveProfile } from "@/app/(app)/me/actions";

export const COUNTRIES: [string, string][] = [
  ["IN", "India"], ["US", "United States"], ["GB", "United Kingdom"],
  ["AE", "UAE"], ["CA", "Canada"], ["AU", "Australia"], ["SG", "Singapore"],
];
export const countryName = (code: string) => COUNTRIES.find(([k]) => k === code)?.[1] ?? code;

const PRIMARY_FIELDS = [
  { key: "energyKcal", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
] as const;
const MORE_FIELDS = [
  { key: "carbs", label: "Carbs", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
  { key: "fibre", label: "Fibre", unit: "g" },
  { key: "sugarsMax", label: "Sugar limit", unit: "g" },
  { key: "sodiumMgMax", label: "Sodium limit", unit: "mg" },
  { key: "satFatMax", label: "Sat. fat limit", unit: "g" },
] as const;
const ALL_FIELDS = [...PRIMARY_FIELDS, ...MORE_FIELDS];
type FieldKey = (typeof ALL_FIELDS)[number]["key"];

function toTextRecord(t: DailyTargets): Record<FieldKey, string> {
  const out = {} as Record<FieldKey, string>;
  for (const f of ALL_FIELDS) out[f.key] = String(t[f.key]);
  return out;
}

const knownAllergies = (list: string[]) => list.filter((a): a is AllergenKey => (ALLERGEN_KEYS as readonly string[]).includes(a));

/** Saves a profile patch through the shared server action; toasts the outcome and refreshes the page on success. */
function useProfileSave(onDone: () => void) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function save(payload: Record<string, unknown>) {
    setPending(true);
    const res = await saveProfile(payload).catch(() => ({ ok: false as const, message: "Couldn't save. Try again." }));
    setPending(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Saved.");
    router.refresh();
    onDone();
  }
  return { pending, save };
}

/** Cancel and Save, the sheet's one main action (mock-c1 sheet footer). */
function SheetActions({ pending, dirty, onCancel, onSave }: { pending: boolean; dirty: boolean; onCancel: () => void; onSave: () => void }) {
  return (
    <div className="grid shrink-0 grid-cols-[1fr_1.3fr] gap-2.5 pt-1">
      <Button type="button" variant="ghost-sunken" shape="pill" size="xl" className="h-[54px] min-w-0 px-4" disabled={pending} onClick={onCancel}>
        Cancel
      </Button>
      <Button type="button" shape="pill" size="xl" className="h-[54px] min-w-0 px-4" disabled={!dirty || pending} onClick={onSave}>
        {pending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Check aria-hidden />}
        {pending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

/** A single-choice list in one card: 54 px rows, a check on the chosen one. */
function OptionList<K extends string>({ label, options, value, onPick }: {
  label: string; options: { key: K; title: string; desc?: string }[]; value: K; onPick: (key: K) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="shrink-0 overflow-hidden rounded-[20px] bg-surface shadow-card">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onPick(o.key)}
            className="flex min-h-[54px] w-full items-center gap-3 px-4 py-2 text-left transition-colors not-first:border-t not-first:border-line hover:bg-sunken/60"
          >
            <span className="min-w-0 flex-1 leading-tight">
              <span className={cn("block truncate font-[550] text-ink", on && "font-semibold")}>{o.title}</span>
              {o.desc && <span className="block truncate text-[12.5px] text-subtle">{o.desc}</span>}
            </span>
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full border-[1.5px]",
                on ? "border-transparent bg-action text-action-ink" : "border-line",
              )}
              aria-hidden
            >
              {on && <Check className="size-3.5" strokeWidth={3} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SubHead({ children }: { children: ReactNode }) {
  return <h3 className="m-0 px-1 text-[12px] font-[650] tracking-[0.06em] text-subtle uppercase">{children}</h3>;
}

function TargetField({ label, unit, value, onChange }: { label: string; unit: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="truncate px-1 text-[13px] font-medium text-subtle">{label}</span>
      <span className="flex h-[52px] items-center gap-2 rounded-2xl border border-line bg-surface px-3.5 focus-within:ring-2 focus-within:ring-brand-deep">
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} (${unit})`}
          className="num h-full w-full min-w-0 bg-transparent text-base font-semibold text-ink outline-none!"
        />
        <span className="shrink-0 text-[13px] text-subtle">{unit}</span>
      </span>
    </label>
  );
}

/** Goal plus the daily targets it sets; targets are stored only where they differ from the goal's preset. */
export function GoalSection({ goal, targets, onDone }: { goal: Goal; targets: Partial<DailyTargets> | null; onDone: () => void }) {
  const { pending, save } = useProfileSave(onDone);
  const [draftGoal, setDraftGoal] = useState(goal);
  const [fields, setFields] = useState(() => toTextRecord(targetsFor(goal, targets)));
  const [edited, setEdited] = useState<Set<FieldKey>>(() => new Set());
  const [showAll, setShowAll] = useState(false);
  const initial = toTextRecord(targetsFor(goal, targets));
  const dirty = draftGoal !== goal || ALL_FIELDS.some((f) => fields[f.key] !== initial[f.key]);

  function pickGoal(next: Goal) {
    setDraftGoal(next);
    // Fields the user hasn't typed in follow the new goal's targets; typed values stay.
    const preset = toTextRecord(targetsFor(next, targets));
    setFields((cur) => {
      const out = { ...cur };
      for (const f of ALL_FIELDS) if (!edited.has(f.key)) out[f.key] = preset[f.key];
      return out;
    });
  }
  function setField(key: FieldKey, v: string) {
    setFields((cur) => ({ ...cur, [key]: v }));
    setEdited((cur) => new Set(cur).add(key));
  }
  function submit() {
    const preset = PRESETS[draftGoal];
    const out: Partial<DailyTargets> = {};
    for (const f of ALL_FIELDS) {
      const raw = fields[f.key];
      if (raw === "") continue;
      const v = Number(raw);
      if (!Number.isFinite(v)) continue;
      if (v !== preset[f.key]) (out as Record<string, number>)[f.key] = v;
    }
    void save({ goal: draftGoal, targets: Object.keys(out).length ? out : null });
  }

  return (
    <>
      <OptionList label="Goal" options={GOALS.map(([key, title, desc]) => ({ key, title, desc }))} value={draftGoal} onPick={pickGoal} />
      <SubHead>Daily targets</SubHead>
      <div className="grid shrink-0 grid-cols-2 gap-2.5">
        {PRIMARY_FIELDS.map((f) => <TargetField key={f.key} label={f.label} unit={f.unit} value={fields[f.key]} onChange={(v) => setField(f.key, v)} />)}
        {showAll && MORE_FIELDS.map((f) => <TargetField key={f.key} label={f.label} unit={f.unit} value={fields[f.key]} onChange={(v) => setField(f.key, v)} />)}
      </div>
      <button
        type="button"
        onClick={() => setShowAll((s) => !s)}
        aria-expanded={showAll}
        className="-my-1.5 inline-flex min-h-11 items-center gap-1 self-start rounded-full px-1 text-[13px] font-semibold whitespace-nowrap text-brand-deep"
      >
        {showAll ? "Fewer targets" : "All targets"}
        <ChevronDown className={cn("size-4 transition-transform", showAll && "rotate-180")} aria-hidden />
      </button>
      <SheetActions pending={pending} dirty={dirty} onCancel={onDone} onSave={submit} />
    </>
  );
}

export function DietSection({ diet, onDone }: { diet: Diet; onDone: () => void }) {
  const { pending, save } = useProfileSave(onDone);
  const [draft, setDraft] = useState(diet);
  return (
    <>
      <OptionList label="Diet" options={DIETS.map(([key, title]) => ({ key, title }))} value={draft} onPick={setDraft} />
      <p className="m-0 px-1 text-[12.5px] leading-snug text-subtle">We flag foods that don&apos;t fit your diet when you scan or add them.</p>
      <SheetActions pending={pending} dirty={draft !== diet} onCancel={onDone} onSave={() => void save({ diet: draft })} />
    </>
  );
}

export function AllergiesSection({ diet, allergies, onDone }: { diet: Diet; allergies: string[]; onDone: () => void }) {
  const { pending, save } = useProfileSave(onDone);
  const start = knownAllergies(allergies);
  const [draft, setDraft] = useState<Set<AllergenKey>>(() => new Set(start));
  const dirty = draft.size !== start.length || start.some((a) => !draft.has(a));
  const toggle = (key: AllergenKey) =>
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  return (
    <>
      <div role="group" aria-label="Allergies" className="flex shrink-0 flex-wrap gap-2">
        {allergensForDiet(diet).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={draft.has(key)}
            onClick={() => toggle(key)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-[14px] font-semibold whitespace-nowrap text-ink transition-colors aria-pressed:border-transparent aria-pressed:bg-action aria-pressed:text-action-ink"
          >
            {draft.has(key) && <Check className="size-4" aria-hidden />}
            {ALLERGEN_LABELS[key]}
          </button>
        ))}
      </div>
      <p className="m-0 px-1 text-[12.5px] leading-snug text-subtle">Foods that contain or may contain these get a warning. Your diet already covers the ones not listed.</p>
      <SheetActions pending={pending} dirty={dirty} onCancel={onDone} onSave={() => void save({ allergies: Array.from(draft) })} />
    </>
  );
}

export function CountrySection({ country, onDone }: { country: string; onDone: () => void }) {
  const { pending, save } = useProfileSave(onDone);
  const [draft, setDraft] = useState(country);
  return (
    <>
      <OptionList label="Country" options={COUNTRIES.map(([key, title]) => ({ key, title }))} value={draft} onPick={setDraft} />
      <p className="m-0 px-1 text-[12.5px] leading-snug text-subtle">Search ranks foods and packs sold in your country first.</p>
      <SheetActions pending={pending} dirty={draft !== country} onCancel={onDone} onSave={() => void save({ country: draft })} />
    </>
  );
}
