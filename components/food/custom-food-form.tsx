"use client";
// The custom food form (/foods/new, and ?edit=<id> for your own food), C1: ghost inputs on --sunken
// in white cards, the "Nutrition is for" choice as chips, and one primary pill to save.
import { useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2, TriangleAlert } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { CARD, StickyActionBar } from "@/components/food/result-parts";
import { cn } from "@/lib/utils";
import { amountError, parseAmount } from "@/lib/parse-amount";
import { customNutrientIssues } from "@/lib/foods/custom-validate";
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
  { key: "energyKcal", label: "Calories", unit: "kcal", max: 5000 },
  { key: "protein", label: "Protein", unit: "g", max: 500 },
  { key: "carbs", label: "Carbs", unit: "g", max: 500 },
  { key: "fat", label: "Fat", unit: "g", max: 500 },
] as const;
const OPTIONAL_FIELDS = [
  { key: "sugars", label: "Sugars", unit: "g", max: 500 },
  { key: "satFat", label: "Saturated fat", unit: "g", max: 500 },
  { key: "fibre", label: "Fibre", unit: "g", max: 500 },
  { key: "sodiumMg", label: "Sodium", unit: "mg", max: 20000 },
] as const;

type FieldId = "name" | "servingGrams" | (typeof REQUIRED_FIELDS)[number]["key"] | (typeof OPTIONAL_FIELDS)[number]["key"];

const FORM_KEYS: readonly string[] = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map((f) => f.key);
const isFormField = (k: string): boolean => FORM_KEYS.includes(k);
/** Stored values with no field on the form, carried through an edit unchanged. */
const extraNutrients = (n: Nutrients): Record<string, number> =>
  Object.fromEntries(Object.entries(n).filter(([k, v]) => !isFormField(k) && typeof v === "number"));
const perOf = (unit: Unit) => (unit === "serving" ? { amount: 1, unit: "serving" as const } : { amount: 100, unit });

function toText(v: number | undefined): string {
  return v === undefined ? "" : String(v);
}

/** A ghost input (mock-c1 `.field` on --sunken): label above, the unit inside on the right, red when it's the one to fix. */
function Field({ id, label, unit, value, onChange, error, inputMode, maxLength }: {
  id: string; label: string; unit?: string; value: string; onChange: (v: string) => void; error: string | null;
  inputMode?: "decimal"; maxLength?: number;
}) {
  const invalid = error !== null;
  const errorId = `${id}-error`;
  return (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1.5">
      <span className="truncate px-1 text-[13px] font-medium text-subtle">{label}</span>
      <span
        className={cn(
          "flex h-[52px] items-center gap-2 rounded-2xl border bg-sunken px-3.5 focus-within:bg-surface focus-within:ring-2",
          invalid ? "border-bad focus-within:ring-bad" : "border-transparent focus-within:ring-brand-deep",
        )}
      >
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode={inputMode}
          maxLength={maxLength}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          className={cn("h-full w-full min-w-0 bg-transparent text-base text-ink outline-none!", inputMode && "num font-semibold")}
        />
        {unit && <span className="shrink-0 text-[13px] text-subtle">{unit}</span>}
      </span>
      {invalid && <span id={errorId} className="px-1 text-[12.5px] leading-snug font-medium text-bad">{error}</span>}
    </label>
  );
}

function SubHead({ children }: { children: ReactNode }) {
  return <h2 className="m-0 px-1 text-[12px] font-[650] tracking-[0.06em] text-subtle uppercase">{children}</h2>;
}

export function CustomFoodForm({ initial }: { initial: CustomFoodFormInitial | null }) {
  const router = useRouter();
  const qc = useQueryClient();
  const uid = useId();
  const formRef = useRef<HTMLFormElement>(null);
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
  const [error, setError] = useState<{ message: string; field: FieldId | null } | null>(null);

  /**
   * The numbers to save: what's typed, over any stored values the form has no field for (added sugars,
   * trans fat on a food saved from a scan), so an edit never drops a stored value.
   */
  function typedNutrients(): Nutrients {
    const out: Record<string, number> = { ...(initial ? extraNutrients(initial.nutrients) : {}) };
    for (const f of [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]) {
      const v = parseAmount(values[f.key]!);
      if (v !== null && !Number.isNaN(v)) out[f.key] = v;
    }
    return out as unknown as Nutrients;
  }

  function validate(): { message: string; field: FieldId | null } | null {
    if (!name.trim()) return { message: "Give it a name.", field: "name" };
    if (unit === "serving") {
      const g = parseAmount(servingGrams);
      if (g === null || !(g >= 1 && g <= 2000)) return { message: "Serving size should be between 1 and 2000 g.", field: "servingGrams" };
    }
    for (const f of REQUIRED_FIELDS) {
      const v = parseAmount(values[f.key]!);
      if (v === null) return { message: `Enter the ${f.label.toLowerCase()}. Use 0 if there's none.`, field: f.key };
      const bad = amountError(values[f.key]!);
      if (bad) return { message: bad, field: f.key };
      if (!(v >= 0 && v <= f.max)) return { message: `${f.label} should be between 0 and ${f.max} ${f.unit}.`, field: f.key };
    }
    for (const f of OPTIONAL_FIELDS) {
      const v = parseAmount(values[f.key]!);
      if (v === null) continue;
      const bad = amountError(values[f.key]!);
      if (bad) return { message: bad, field: f.key };
      if (!(v >= 0 && v <= f.max)) return { message: `${f.label} should be between 0 and ${f.max} ${f.unit}.`, field: f.key };
    }
    // The shared plausibility bounds (sugars within carbs, sodium within pure salt, ...): the same
    // check the API makes, shown under the field before saving.
    const issue = customNutrientIssues({ per: perOf(unit), servingGrams: parseAmount(servingGrams), nutrients: typedNutrients() })
      .find((i) => isFormField(i.field));
    if (issue) return { message: issue.message, field: issue.field as FieldId };
    return null;
  }

  const save = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      const trimmedBrand = brand.trim();
      const body = {
        name: trimmed,
        ...(trimmedBrand ? { brand: trimmedBrand } : {}),
        per: perOf(unit),
        ...(unit === "serving" ? { servingGrams: parseAmount(servingGrams) } : {}),
        nutrients: typedNutrients(),
      };
      return initial
        ? api<{ food: { id: string } }>(`/api/v1/foods/${initial.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : api<{ food: { id: string } }>("/api/v1/foods", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: async (res) => {
      toast.success("Saved to My foods.");
      await qc.invalidateQueries({ queryKey: ["foods"] });
      // Replace, so Back from the food's page doesn't land on this form again.
      router.replace(`/foods/${res.food.id}`);
      router.refresh();
    },
    onError: (e) => {
      const message = e instanceof ApiError ? e.message : "Couldn't save that. Try again.";
      // The API names the field for a plausibility issue; show the message under it.
      const field = e instanceof ApiError && e.field && isFormField(e.field) ? (e.field as FieldId) : null;
      setError({ message, field });
      toast.error(message);
    },
  });

  const fieldId = (f: FieldId) => `${uid}-${f}`;
  const fieldError = (f: FieldId) => (error?.field === f ? error.message : null);
  /** Typing in the field that was flagged clears its message. */
  const edit = (f: FieldId, set: (v: string) => void) => (v: string) => {
    set(v);
    if (error?.field === f) setError(null);
  };
  const setValue = (key: (typeof REQUIRED_FIELDS | typeof OPTIONAL_FIELDS)[number]["key"]) =>
    edit(key, (v) => setValues((cur) => ({ ...cur, [key]: v })));

  return (
    <form
      ref={formRef}
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const problem = validate();
        setError(problem);
        if (problem?.field) formRef.current?.querySelector<HTMLInputElement>(`#${CSS.escape(fieldId(problem.field))}`)?.focus();
        if (!problem) save.mutate();
      }}
    >
      <section className={cn(CARD, "flex flex-col gap-3")}>
        <Field id={fieldId("name")} label="Name" value={name} onChange={edit("name", setName)} maxLength={120} error={fieldError("name")} />
        <Field id={`${uid}-brand`} label="Brand (optional)" value={brand} onChange={setBrand} maxLength={80} error={null} />
      </section>

      <section className={cn(CARD, "flex flex-col gap-3")}>
        <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-2 px-1 text-[13px] font-medium text-subtle">Nutrition is for</legend>
          <div className="grid grid-cols-3 gap-1.5">
            {(["serving", "g", "ml"] as const).map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={unit === u}
                onClick={() => setUnit(u)}
                className="min-h-11 min-w-0 truncate rounded-[13px] border border-line bg-surface px-2 text-[13px] font-semibold whitespace-nowrap text-subtle transition-colors aria-pressed:border-transparent aria-pressed:bg-action aria-pressed:text-action-ink"
              >
                {UNIT_LABEL[u]}
              </button>
            ))}
          </div>
        </fieldset>
        {unit === "serving" && (
          <Field id={fieldId("servingGrams")} label="Serving size" unit="g" inputMode="decimal" value={servingGrams} onChange={edit("servingGrams", setServingGrams)} error={fieldError("servingGrams")} />
        )}
        <div className="grid grid-cols-2 gap-2.5">
          {REQUIRED_FIELDS.map((f) => (
            <Field key={f.key} id={fieldId(f.key)} label={f.label} unit={f.unit} inputMode="decimal" value={values[f.key]!} onChange={setValue(f.key)} error={fieldError(f.key)} />
          ))}
        </div>
      </section>

      <section className={cn(CARD, "flex flex-col gap-3")}>
        <SubHead>Optional</SubHead>
        <div className="grid grid-cols-2 gap-2.5">
          {OPTIONAL_FIELDS.map((f) => (
            <Field key={f.key} id={fieldId(f.key)} label={f.label} unit={f.unit} inputMode="decimal" value={values[f.key]!} onChange={setValue(f.key)} error={fieldError(f.key)} />
          ))}
        </div>
      </section>

      {error && error.field === null && (
        <p role="alert" className="m-0 flex items-start gap-2 rounded-[14px] bg-bad/10 px-3 py-2.5 text-[13px] leading-snug font-medium text-bad">
          <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden />
          {error.message}
        </p>
      )}

      <StickyActionBar fullWidth>
        <div className="mx-auto grid max-w-[560px] lg:max-w-none">
          <Button type="submit" shape="pill" size="xl" className="h-[54px] w-full min-w-0 px-4" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Check aria-hidden />}
            {save.isPending ? "Saving…" : initial ? "Save changes" : "Save to My foods"}
          </Button>
        </div>
      </StickyActionBar>
    </form>
  );
}
