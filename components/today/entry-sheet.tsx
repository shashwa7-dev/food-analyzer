"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Undo2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GradeBadge } from "@/components/grade-badge";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { api, ApiError } from "@/lib/api-client";
import { isFreeGramsPortion, portionMeta } from "@/lib/log/format";
import { stepQuantity } from "@/lib/log/quantity";
import { MEALS, type Meal } from "@/lib/nutrition/types";
import { undoBody, undoNeedsPortions, undoTarget } from "@/lib/log/undo";
import type { EntryRow } from "@/lib/log/service";
import type { Portion } from "@/lib/nutrition/types";

function EntrySheetBody({ entry, onClose }: { entry: EntryRow; onClose: () => void }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(entry.portion.amount);
  const [gramsText, setGramsText] = useState(String(entry.portion.grams ?? ""));
  const [meal, setMeal] = useState<Meal>(entry.meal);
  const [confirming, setConfirming] = useState(false);
  // Only link to the food while it is still visible to the user (custom foods can be soft-deleted).
  const linked = useQuery({
    queryKey: ["foods", entry.foodId],
    queryFn: () => api<unknown>(`/api/v1/foods/${entry.foodId}`),
    enabled: entry.foodId !== null,
    retry: false,
  });
  const freeGrams = isFreeGramsPortion(entry.portion);
  const unit = entry.portion.unit === "ml" ? "ml" : "g";
  const grams = Number(gramsText);
  const gramsValid = !freeGrams || (gramsText.trim() !== "" && Number.isFinite(grams) && grams >= 1 && grams <= 5000);
  const factor = freeGrams
    ? (gramsValid && entry.portion.grams ? grams / entry.portion.grams : 1)
    : (entry.portion.amount > 0 ? quantity / entry.portion.amount : 1);
  const kcal = Math.round(entry.nutrients.energyKcal * factor);
  const patch: { quantity?: number; grams?: number; meal?: Meal } = {};
  if (freeGrams && gramsValid && grams !== entry.portion.grams) patch.grams = grams;
  if (!freeGrams && quantity !== entry.portion.amount) patch.quantity = quantity;
  if (meal !== entry.meal) patch.meal = meal;
  const dirty = Object.keys(patch).length > 0 && gramsValid;
  const done = (message: string) => {
    toast.success(message);
    router.refresh();
    onClose();
  };
  const save = useMutation({
    mutationFn: () => api(`/api/v1/log/${entry.id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => done("Entry updated."),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't update that. Try again."),
  });
  const del = useMutation({
    mutationFn: () => api(`/api/v1/log/${entry.id}`, { method: "DELETE" }),
    onSuccess: () => {
      setConfirming(false);
      router.refresh();
      onClose();
      toast.success("Entry deleted", {
        action: { label: <><Undo2 className="size-4" aria-hidden />Undo</>, onClick: () => void restoreEntry(entry, () => router.refresh()) },
      });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't delete that. Try again."),
  });
  const busy = save.isPending || del.isPending;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <GradeBadge grade={entry.grade} />
        <div className="min-w-0 flex-1">
          <div className="text-sm text-subtle">{portionMeta(entry.portion)}</div>
        </div>
        {linked.isSuccess && (
          <Link href={`/foods/${entry.foodId}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-accent">
            View food
          </Link>
        )}
        {!linked.isSuccess && entry.scanId && (
          <Link href={`/scans/${entry.scanId}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-accent">
            View scan
          </Link>
        )}
      </div>
      {freeGrams ? (
        <label className="flex items-center justify-between gap-3 text-sm text-subtle">
          Amount ({unit})
          <input
            inputMode="decimal"
            value={gramsText}
            onChange={(e) => setGramsText(e.target.value)}
            aria-invalid={!gramsValid}
            className="num min-h-11 w-28 rounded-md border border-line bg-surface px-3 text-right text-base text-ink outline-none focus-visible:border-accent aria-invalid:border-bad"
          />
        </label>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-sm text-subtle">How many?</span>
          <div className="flex items-center overflow-hidden rounded-md border border-line">
            <button type="button" className="size-11 text-xl font-bold" aria-label="Less" onClick={() => setQuantity((q) => stepQuantity(q, -1))}>−</button>
            <span className="num min-w-16 text-center font-semibold">{quantity}</span>
            <button type="button" className="size-11 text-xl font-bold" aria-label="More" onClick={() => setQuantity((q) => stepQuantity(q, 1))}>+</button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-subtle">Meal</span>
        <div className="flex flex-wrap gap-2">
          {MEALS.map((m) => (
            <button key={m} type="button" aria-pressed={m === meal} onClick={() => setMeal(m)}
              className="min-h-11 rounded-md border border-line bg-surface px-3 text-sm font-medium capitalize aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg">
              {m}
            </button>
          ))}
        </div>
      </div>
      <Button className="h-12 w-full" disabled={!dirty || busy} onClick={() => save.mutate()}>
        {save.isPending ? "Saving…" : <>Save · <span className="num">{kcal}</span> kcal</>}
      </Button>
      <Button type="button" variant="outline" className="h-11 w-full gap-1.5 text-bad" disabled={busy} onClick={() => setConfirming(true)}>
        <Trash2 className="size-4" aria-hidden /> Delete entry
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        icon={<Trash2 aria-hidden />}
        title="Delete this entry?"
        body={`It comes off ${entry.meal === "snack" ? "snacks" : entry.meal} and out of the day’s totals. You can undo it right after.`}
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        onConfirm={() => del.mutate()}
        pending={del.isPending}
      />
    </div>
  );
}

/**
 * The delete toast's Undo: logs the entry again through POST /api/v1/log from its food or scan
 * (same portion and amount), or as a quick add with its own nutrients when that source is gone.
 */
async function restoreEntry(entry: EntryRow, refresh: () => void) {
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
    refresh();
  } catch (e) {
    toast.error(e instanceof ApiError ? e.message : "Couldn't restore that entry. Try again.");
  }
}

export function EntrySheet({ entry, open, onOpenChange }: { entry: EntryRow; open: boolean; onOpenChange: (open: boolean) => void }) {
  const isDesktop = useMediaQuery("(min-width: 900px)");
  const close = () => onOpenChange(false);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogTitle className="section-title pr-8">{entry.name}</DialogTitle>
          <EntrySheetBody entry={entry} onClose={close} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="section-title text-left">{entry.name}</DrawerTitle>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-4 pt-2 pb-[calc(16px+env(safe-area-inset-bottom))]">
          <EntrySheetBody entry={entry} onClose={close} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
