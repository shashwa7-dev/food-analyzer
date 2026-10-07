"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { PRESETS, targetsFor } from "@/lib/nutrition/targets";
import { ALLERGEN_KEYS, allergensForDiet, type AllergenKey } from "@/lib/nutrition/personalise";
import type { DailyTargets, Diet, Goal } from "@/lib/nutrition/types";
import { GOALS, GOAL_LABEL, DIETS, DIET_LABEL, ALLERGEN_LABELS } from "@/lib/profile/options";
import { saveProfile, deleteAccountAction } from "@/app/(app)/me/actions";

const COUNTRIES: [string, string][] = [
  ["IN", "India"], ["US", "United States"], ["GB", "United Kingdom"],
  ["AE", "UAE"], ["CA", "Canada"], ["AU", "Australia"], ["SG", "Singapore"],
];
const PRIMARY_FIELDS = [
  { key: "energyKcal", label: "Calories (kcal)" },
  { key: "protein", label: "Protein (g)" },
] as const;
const MORE_FIELDS = [
  { key: "carbs", label: "Carbs (g)" },
  { key: "fat", label: "Fat (g)" },
  { key: "fibre", label: "Fibre (g)" },
  { key: "sugarsMax", label: "Sugar limit (g)" },
  { key: "sodiumMgMax", label: "Sodium limit (mg)" },
  { key: "satFatMax", label: "Saturated fat limit (g)" },
] as const;
const ALL_FIELDS = [...PRIMARY_FIELDS, ...MORE_FIELDS];
type FieldKey = (typeof ALL_FIELDS)[number]["key"];

function toTextRecord(preset: DailyTargets): Record<FieldKey, string> {
  const out = {} as Record<FieldKey, string>;
  for (const f of ALL_FIELDS) out[f.key] = String(preset[f.key]);
  return out;
}

export interface SettingsInitial {
  goal: Goal;
  diet: Diet;
  allergies: string[];
  targets: Partial<DailyTargets> | null;
  country: string;
}

type Section = "goal" | "diet" | "allergies" | "targets" | "country" | null;

function chipClass(selected: boolean) {
  return cn(
    "min-h-11 rounded-md border border-line bg-surface px-3.5 text-sm font-medium",
    selected && "border-ink bg-ink text-bg",
  );
}

function Row({ label, value, open, onToggle, children }: { label: string; value: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border-b border-line py-1 last:border-b-0">
      <button type="button" onClick={onToggle} className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left">
        <span className="text-sm">{label}</span>
        <span className="flex items-center gap-1.5 text-sm text-subtle">
          {value}
          <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} aria-hidden />
        </span>
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  );
}

export function SettingsForm({ initial }: { initial: SettingsInitial }) {
  const router = useRouter();
  const [open, setOpen] = useState<Section>(null);
  const [goal, setGoal] = useState(initial.goal);
  const [diet, setDiet] = useState(initial.diet);
  const [allergies, setAllergies] = useState<Set<AllergenKey>>(
    () => new Set(initial.allergies.filter((a): a is AllergenKey => (ALLERGEN_KEYS as readonly string[]).includes(a))),
  );
  const [country, setCountry] = useState(initial.country);
  const [targets, setTargets] = useState(initial.targets);
  const [draftAllergies, setDraftAllergies] = useState<Set<AllergenKey>>(allergies);
  const [fields, setFields] = useState<Record<FieldKey, string>>(() => toTextRecord(targetsFor(initial.goal, initial.targets)));
  const [showAll, setShowAll] = useState(false);
  const [pending, setPending] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function save(payload: Record<string, unknown>) {
    setPending(true);
    const res = await saveProfile(payload);
    setPending(false);
    if (!res.ok) {
      toast.error(res.message);
      return false;
    }
    toast.success("Saved.");
    router.refresh();
    return true;
  }

  function toggle(section: Section) {
    if (section === "allergies") setDraftAllergies(allergies);
    if (section === "targets") setFields(toTextRecord(targetsFor(goal, targets)));
    setOpen((cur) => (cur === section ? null : section));
  }

  async function pickGoal(key: Goal) {
    if (!(await save({ goal: key }))) return;
    setGoal(key);
    setOpen(null);
  }
  async function pickDiet(key: Diet) {
    if (!(await save({ diet: key }))) return;
    setDiet(key);
    const allowed = new Set(allergensForDiet(key));
    setAllergies((prev) => new Set(Array.from(prev).filter((a) => allowed.has(a))));
    setDraftAllergies((prev) => new Set(Array.from(prev).filter((a) => allowed.has(a))));
    setOpen(null);
  }
  async function pickCountry(key: string) {
    if (!(await save({ country: key }))) return;
    setCountry(key);
    setOpen(null);
  }
  async function saveAllergies() {
    if (!(await save({ allergies: Array.from(draftAllergies) }))) return;
    setAllergies(draftAllergies);
    setOpen(null);
  }
  async function saveTargets() {
    const preset = PRESETS[goal];
    const out: Partial<DailyTargets> = {};
    for (const f of ALL_FIELDS) {
      const raw = fields[f.key];
      if (raw === "") continue;
      const v = Number(raw);
      if (!Number.isFinite(v)) continue;
      if (v !== preset[f.key]) (out as Record<string, number>)[f.key] = v;
    }
    const next = Object.keys(out).length ? out : null;
    if (!(await save({ targets: next }))) return;
    setTargets(next);
    setOpen(null);
  }

  async function signOut() {
    await authClient.signOut();
    router.replace("/");
  }

  async function confirmDelete() {
    setDeleting(true);
    const res = await deleteAccountAction(confirmText);
    setDeleting(false);
    if (res && !res.ok) toast.error(res.message);
  }

  const effective = targetsFor(goal, targets);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-line bg-surface p-1 px-3">
        <Row label="Goal" value={GOAL_LABEL[goal]} open={open === "goal"} onToggle={() => toggle("goal")}>
          <div className="flex flex-wrap gap-2">
            {GOALS.map(([key, label]) => (
              <button key={key} type="button" aria-pressed={goal === key} disabled={pending} onClick={() => void pickGoal(key)} className={chipClass(goal === key)}>
                {label}
              </button>
            ))}
          </div>
        </Row>
        <Row label="Diet" value={DIET_LABEL[diet]} open={open === "diet"} onToggle={() => toggle("diet")}>
          <div className="flex flex-wrap gap-2">
            {DIETS.map(([key, label]) => (
              <button key={key} type="button" aria-pressed={diet === key} disabled={pending} onClick={() => void pickDiet(key)} className={chipClass(diet === key)}>
                {label}
              </button>
            ))}
          </div>
        </Row>
        <Row
          label="Allergies"
          value={allergies.size ? Array.from(allergies).map((a) => ALLERGEN_LABELS[a]).join(", ") : "None"}
          open={open === "allergies"}
          onToggle={() => toggle("allergies")}
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {allergensForDiet(diet).map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={draftAllergies.has(key)}
                  onClick={() =>
                    setDraftAllergies((prev) => {
                      const next = new Set(prev);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    })
                  }
                  className={chipClass(draftAllergies.has(key))}
                >
                  {ALLERGEN_LABELS[key]}
                </button>
              ))}
            </div>
            <Button type="button" className="h-11 self-start px-4" disabled={pending} onClick={() => void saveAllergies()}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </Row>
        <Row
          label="Daily targets"
          value={`${effective.energyKcal.toLocaleString("en-IN")} kcal · ${effective.protein} g protein`}
          open={open === "targets"}
          onToggle={() => toggle("targets")}
        >
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              {PRIMARY_FIELDS.map((f) => (
                <label key={f.key} className="flex flex-col gap-1.5 text-sm font-medium">
                  {f.label}
                  <input
                    inputMode="decimal"
                    value={fields[f.key]}
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
                      value={fields[f.key]}
                      onChange={(e) => setFields((v) => ({ ...v, [f.key]: e.target.value }))}
                      className="num min-h-11 rounded-md border border-line bg-surface px-3 text-base outline-none focus-visible:border-accent"
                    />
                  </label>
                ))}
              </div>
            )}
            <Button type="button" className="h-11 self-start px-4" disabled={pending} onClick={() => void saveTargets()}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </Row>
        <Row label="Country" value={COUNTRIES.find(([k]) => k === country)?.[1] ?? country} open={open === "country"} onToggle={() => toggle("country")}>
          <div className="flex flex-wrap gap-2">
            {COUNTRIES.map(([key, label]) => (
              <button key={key} type="button" aria-pressed={country === key} disabled={pending} onClick={() => void pickCountry(key)} className={chipClass(country === key)}>
                {label}
              </button>
            ))}
          </div>
        </Row>
      </section>

      <section className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface px-3">
        <Link href="/onboarding?redo=1" className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
          <span>Set up again</span>
          <span className="flex items-center gap-1.5 text-subtle"><ChevronRight className="size-4" aria-hidden /></span>
        </Link>
        <Link href="/about/data" className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
          <span>Data sources</span>
          <span className="flex items-center gap-1.5 text-subtle">INDB · USDA · OFF<ChevronRight className="size-4" aria-hidden /></span>
        </Link>
        <Link href="/privacy" className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
          <span>Privacy</span>
          <ChevronRight className="size-4 text-subtle" aria-hidden />
        </Link>
        <Link href="/terms" className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
          <span>Terms</span>
          <ChevronRight className="size-4 text-subtle" aria-hidden />
        </Link>
      </section>

      <Button type="button" variant="outline" className="h-11" onClick={() => void signOut()}>
        Sign out
      </Button>

      <Button type="button" variant="ghost" className="h-11 text-bad hover:text-bad" onClick={() => setDeleteOpen(true)}>
        Delete account
      </Button>

      <Dialog
        open={deleteOpen}
        onOpenChange={(v) => {
          setDeleteOpen(v);
          if (!v) setConfirmText("");
        }}
      >
        <DialogContent>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription>
            This permanently deletes your profile and diary. This can&apos;t be undone. Type <strong>DELETE</strong> to confirm.
          </DialogDescription>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            aria-label="Type DELETE to confirm"
            className="min-h-11 rounded-md border border-line bg-surface px-3 text-base outline-none focus-visible:border-accent"
          />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" className="h-11" />}>Cancel</DialogClose>
            <Button type="button" variant="destructive" className="h-11" disabled={confirmText !== "DELETE" || deleting} onClick={() => void confirmDelete()}>
              {deleting ? "Deleting…" : "Delete account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
