"use client";
// Client parts of /scans/[id]: the running state, the top bar (Back and the Delete overflow), and the
// sticky actions (Save food, and Add to {Meal}, which opens the add sheet with the scan as its target).
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck, Loader2, Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { OverflowMenu } from "@/components/ui/overflow-menu";
import { BackButton } from "@/components/nav/back-button";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { AddToMeal, type LoggableFood } from "@/components/food/add-to-meal";
import { MEAL_META } from "@/components/food/meal-meta";
import { FlagNotes, FoodSheetHeader } from "@/components/food/sheet-parts";
import { StickyActionBar } from "@/components/food/result-parts";
import type { FoodIconKey } from "@/lib/foods/icon";
import type { Flag, Meal } from "@/lib/nutrition/types";
import { AnalysingCard } from "./analysing-card";

/** /scans/[id] while the scan is still queued/processing: the Analysing card, then a refresh into the result. */
export function RunningScan({ scanId }: { scanId: string }) {
  const router = useRouter();
  return <AnalysingCard scanId={scanId} onFinished={() => router.refresh()} />;
}

export const DELETE_SCAN_COPY = "It disappears from your history. Foods you logged from it stay in your diary. The scan still counts toward this month's 20.";

/**
 * The result's top bar (mock-c1 `.res-top`): Back (to the app page it came from, else History), the
 * title, and an overflow with "Delete scan". Deleting (DELETE /api/v1/scans/:id, a soft delete) asks
 * first with the spec §6.6 dialog; a deleted scan still counts toward the month, and the copy says so.
 */
export function ResultTopBar({ scanId, title }: { scanId: string; title: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const del = useMutation({
    mutationFn: async () => {
      try {
        await api(`/api/v1/scans/${scanId}`, { method: "DELETE" });
      } catch (e) {
        // Already gone (a second tap, or deleted elsewhere) is the outcome the user wanted — not an error.
        if (!(e instanceof ApiError && e.status === 404)) throw e;
      }
    },
    onSuccess: async () => {
      toast.success("Scan deleted.");
      await qc.invalidateQueries({ queryKey: ["scans"] });
      router.replace("/history");
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't delete that. Try again."),
  });

  return (
    <div className="flex items-center justify-between gap-2.5">
      <BackButton fallback="/history" />
      <p className="m-0 min-w-0 truncate text-[17px] font-semibold whitespace-nowrap text-ink">{title}</p>
      <OverflowMenu items={[{ label: "Delete scan", icon: <Trash2 />, tone: "danger", onSelect: () => setConfirm(true) }]} />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        icon={<Trash2 />}
        title="Delete this scan?"
        body={DELETE_SCAN_COPY}
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        pending={del.isPending}
        onConfirm={() => del.mutate()}
      />
    </div>
  );
}

/** "Save food": a private custom food copied from the scan (POST /foods { fromScanId }); then a link to it. */
function SaveFood({ scanId }: { scanId: string }) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: () => api<{ food: { id: string } }>("/api/v1/foods", { method: "POST", body: JSON.stringify({ fromScanId: scanId }) }),
    onSuccess: () => {
      toast.success("Saved to My foods. It will show up in search.");
      void qc.invalidateQueries({ queryKey: ["foods"] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't save that. Try again."),
  });
  const cls = "h-[54px] w-full min-w-0 px-4";
  if (save.data) {
    return (
      <Button render={<Link href={`/foods/${save.data.food.id}`} />} nativeButton={false} variant="ghost-sunken" shape="pill" size="xl" className={cls}>
        <BookmarkCheck className="text-brand-deep" aria-hidden /> Saved
      </Button>
    );
  }
  return (
    <Button type="button" variant="ghost-sunken" shape="pill" size="xl" className={cls} disabled={save.isPending} onClick={() => save.mutate()}>
      {save.isPending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Bookmark aria-hidden />}
      {save.isPending ? "Saving…" : "Save food"}
    </Button>
  );
}

/**
 * The sticky action bar (mock-c1 `.actions`): Save food (ghost; only when the scan has per-100 values
 * to save) and Add to {Meal} (solid), which opens the add sheet logging the scan's own result (log
 * kinds scan / scan_grams). After adding, goes to that day on Today.
 */
export function ResultActions({ scanId, food, canSave, date, defaultMeal, isToday, iconKey, grade, subtitle, flags }: {
  scanId: string; food: LoggableFood; canSave: boolean; date: string; defaultMeal: Meal; isToday: boolean;
  iconKey: FoodIconKey; /** A letter, "?" (grade unavailable) or null. */ grade: string | null; subtitle: string; flags: Flag[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  return (
    <>
      <StickyActionBar>
        <div className={canSave ? "mx-auto grid max-w-[560px] grid-cols-[1fr_1.2fr] gap-2.5 lg:max-w-none" : "mx-auto grid max-w-[560px] lg:max-w-none"}>
          {canSave && <SaveFood scanId={scanId} />}
          <Button
            type="button"
            shape="pill"
            size="xl"
            className="h-[54px] w-full min-w-0 px-4"
            onClick={() => {
              setSession((n) => n + 1);
              setOpen(true);
            }}
          >
            <Plus aria-hidden />
            <span className="truncate">Add to {MEAL_META[defaultMeal].label}</span>
          </Button>
        </div>
      </StickyActionBar>
      <ResponsiveSheet open={open} onOpenChange={setOpen}>
        <FoodSheetHeader iconKey={iconKey} name={food.name} subtitle={subtitle} grade={grade} />
        <AddToMeal
          key={session}
          food={food}
          target={{ kind: "scan", scanId }}
          date={date}
          defaultMeal={defaultMeal}
          notes={<FlagNotes flags={flags} />}
          onDone={() => {
            setOpen(false);
            router.push(isToday ? "/today" : `/today?date=${date}`);
          }}
        />
      </ResponsiveSheet>
    </>
  );
}
