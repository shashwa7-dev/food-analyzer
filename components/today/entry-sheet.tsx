"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { Check, ChevronRight, Loader2, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ResponsiveSheet, SheetTitle } from "@/components/ui/responsive-sheet";
import { FoodIcon } from "@/components/food/food-icon";
import { AmountStepper } from "@/components/food/amount-stepper";
import { LiveMacros, MealSelect } from "@/components/food/sheet-parts";
import { MEAL_META } from "@/components/food/meal-meta";
import { api, ApiError } from "@/lib/api-client";
import { foodIconKey } from "@/lib/foods/icon";
import { isFreeGramsPortion } from "@/lib/log/format";
import { MAX_QUANTITY } from "@/lib/log/quantity";
import { multiplierUnit, stepAmount, stepFor, unitWord } from "@/lib/log/stepper";
import { invalidateLogQueries } from "@/lib/log/invalidate";
import { undoBody, undoNeedsPortions, undoTarget } from "@/lib/log/undo";
import type { EntryRow } from "@/lib/log/service";
import type { Meal, Portion } from "@/lib/nutrition/types";

const MAX_GRAMS = 5000;
type LinkedFood = { food: { name: string; source: string; barcode: string | null; gradeCategory: string | null; categories: string[] } };

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The edit-entry sheet (spec §6.4): the add sheet's layout for an entry already logged. The head has
 * the logged time and a round red delete (ConfirmDialog, then an Undo toast); a Meal field; Cancel /
 * Save. Entries logged by grams are edited in grams and portion entries by amount (M1: PATCH takes
 * one or the other, never a switch between them).
 */
function EntrySheetBody({ entry, onClose }: { entry: EntryRow; onClose: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const freeGrams = isFreeGramsPortion(entry.portion);
  const unit = entry.portion.unit === "ml" ? "ml" : "g";
  const [quantity, setQuantity] = useState(entry.portion.amount);
  const [gramsText, setGramsText] = useState(String(entry.portion.grams ?? ""));
  const [meal, setMeal] = useState<Meal>(entry.meal);
  const [confirming, setConfirming] = useState(false);
  // Only link to the food while it is still visible to the user (custom foods can be soft-deleted).
  const linked = useQuery({
    queryKey: ["foods", entry.foodId],
    queryFn: () => api<LinkedFood>(`/api/v1/foods/${entry.foodId}`),
    enabled: entry.foodId !== null,
    retry: false,
  });

  const typed = Number(gramsText);
  const gramsValid = !freeGrams || (gramsText.trim() !== "" && Number.isFinite(typed) && typed >= 1 && typed <= MAX_GRAMS);
  const factor = freeGrams
    ? (gramsValid && entry.portion.grams ? typed / entry.portion.grams : 1)
    : (entry.portion.amount > 0 ? quantity / entry.portion.amount : 1);
  const n = entry.nutrients;
  const grams = entry.portion.grams === null ? null : entry.portion.grams * factor;

  const stepUnit = freeGrams ? unit : multiplierUnit(entry.portion.unit);
  const amount = freeGrams ? (gramsValid ? typed : 0) : quantity;
  const max = freeGrams ? MAX_GRAMS : MAX_QUANTITY;
  const step = (dir: 1 | -1) => {
    const next = Math.min(max, stepAmount(amount, stepUnit, dir));
    if (freeGrams) setGramsText(String(next));
    else setQuantity(next);
  };
  const sub = freeGrams
    ? (unit === "ml" ? "millilitres" : "grams")
    : `${unitWord(entry.portion.label, quantity)}${grams !== null ? ` · ${round1(grams)} ${unit}` : ""}`;

  const patch: { quantity?: number; grams?: number; meal?: Meal } = {};
  if (freeGrams && gramsValid && typed !== entry.portion.grams) patch.grams = typed;
  if (!freeGrams && quantity !== entry.portion.amount) patch.quantity = quantity;
  if (meal !== entry.meal) patch.meal = meal;
  const dirty = Object.keys(patch).length > 0 && gramsValid;

  const save = useMutation({
    mutationFn: () => api(`/api/v1/log/${entry.id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => {
      toast.success("Entry updated");
      invalidateLogQueries(qc);
      router.refresh();
      onClose();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't update that. Try again."),
  });
  const del = useMutation({
    mutationFn: () => api(`/api/v1/log/${entry.id}`, { method: "DELETE" }),
    onSuccess: () => {
      setConfirming(false);
      invalidateLogQueries(qc);
      router.refresh();
      onClose();
      // One restore per toast, however fast Undo is tapped twice.
      let restored = false;
      toast.success("Entry deleted", {
        action: {
          label: <><Undo2 className="size-4" aria-hidden />Undo</>,
          onClick: () => {
            if (restored) return;
            restored = true;
            void restoreEntry(entry, qc, () => router.refresh());
          },
        },
      });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't delete that. Try again."),
  });
  const busy = save.isPending || del.isPending;
  const iconKey = foodIconKey(linked.data?.food ?? { name: entry.name, source: "" });

  return (
    <>
      <div className="flex items-center gap-3">
        <FoodIcon iconKey={iconKey} size="lg" tone="brand" />
        <div className="min-w-0 flex-1 leading-tight">
          <SheetTitle className="block truncate text-[18px] font-semibold tracking-[-0.02em] text-ink">{entry.name}</SheetTitle>
          <span className="block truncate text-[13px] text-subtle">Logged {format(new Date(entry.createdAt), "h:mm aaa")}</span>
        </div>
        <button
          type="button"
          aria-label="Delete entry"
          disabled={busy}
          onClick={() => setConfirming(true)}
          className="grid size-11 shrink-0 place-items-center rounded-full border border-grade-e/30 bg-surface text-grade-e transition-colors hover:bg-grade-e/10 disabled:opacity-50"
        >
          <Trash2 className="size-5" aria-hidden />
        </button>
      </div>
      <AmountStepper
        amount={amount}
        sub={sub}
        onStep={step}
        canDecrease={amount > stepFor(stepUnit)}
        canIncrease={amount < max}
        input={freeGrams ? { value: gramsText, onChange: setGramsText, invalid: !gramsValid, label: `Amount in ${unit}` } : undefined}
      />
      <MealSelect meal={meal} onPick={setMeal} />
      <LiveMacros kcal={n.energyKcal * factor} protein={n.protein * factor} carbs={n.carbs * factor} fat={n.fat * factor} />
      <div className="grid grid-cols-[1fr_1.3fr] gap-2.5">
        <Button type="button" variant="ghost-sunken" shape="pill" size="xl" className="h-[54px] min-w-0 px-4" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" shape="pill" size="xl" className="h-[54px] min-w-0 px-4" disabled={!dirty || busy} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Check aria-hidden />}
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
      {/* N9: "View scan" waits for the food lookup, so it never flashes before "View food" replaces it. */}
      {linked.isSuccess && (
        <SourceLink href={`/foods/${entry.foodId}`}>View food</SourceLink>
      )}
      {entry.scanId && (!entry.foodId || linked.isError) && (
        <SourceLink href={`/scans/${entry.scanId}`}>View scan</SourceLink>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        icon={<Trash2 aria-hidden />}
        title="Delete this entry?"
        body={`It comes off ${MEAL_META[entry.meal].label.toLowerCase()} and out of the day’s totals. You can undo it right after.`}
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        onConfirm={() => del.mutate()}
        pending={del.isPending}
      />
    </>
  );
}

function SourceLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="-my-1.5 inline-flex min-h-11 items-center justify-center gap-1 self-center rounded-full px-3 text-[13px] font-semibold whitespace-nowrap text-brand-deep">
      {children}
      <ChevronRight className="size-4" aria-hidden />
    </Link>
  );
}

/**
 * The delete toast's Undo: logs the entry again through POST /api/v1/log from its food or scan
 * (same portion and amount), or as a quick add with its own nutrients when that source is gone.
 */
async function restoreEntry(entry: EntryRow, qc: QueryClient, refresh: () => void) {
  try {
    let portions: Portion[] | null = null;
    const target = undoTarget(entry);
    if (target && undoNeedsPortions(entry)) {
      portions = target.kind === "scan"
        ? (await api<{ result: { portions: Portion[] } | null }>(`/api/v1/scans/${target.scanId}`).catch(() => null))?.result?.portions ?? null
        : (await api<{ food: { portions: Portion[] } }>(`/api/v1/foods/${target.foodId}`).catch(() => null))?.food.portions ?? null;
    }
    await api("/api/v1/log", { method: "POST", body: JSON.stringify(undoBody(entry, portions)) });
    toast.success("Entry restored");
    invalidateLogQueries(qc);
    refresh();
  } catch (e) {
    toast.error(e instanceof ApiError ? e.message : "Couldn't restore that entry. Try again.");
  }
}

export function EntrySheet({ entry, open, onOpenChange }: { entry: EntryRow; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange}>
      <EntrySheetBody entry={entry} onClose={() => onOpenChange(false)} />
    </ResponsiveSheet>
  );
}
