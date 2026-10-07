"use client";
// Client parts of /scans/[id]: the running state, the top bar (Back and the Delete overflow), and the
// sticky actions (Save food, and Add to {Meal}, which opens the add sheet with the scan as its target).
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Popover } from "@base-ui/react/popover";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck, ChevronLeft, Ellipsis, Loader2, Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ResponsiveSheet, SheetTitle } from "@/components/ui/responsive-sheet";
import { GradeBadge } from "@/components/grade-badge";
import { AddToMeal, type LoggableFood } from "@/components/food/add-to-meal";
import { FoodIcon } from "@/components/food/food-icon";
import { MEAL_META } from "@/components/food/meal-meta";
import { FlagNotes } from "@/components/food/sheet-parts";
import { backAction, readInAppNav } from "@/lib/nav/back";
import type { FoodIconKey } from "@/lib/foods/icon";
import type { Flag, Grade, Meal } from "@/lib/nutrition/types";
import { AnalysingCard } from "./analysing-card";

/** /scans/[id] while the scan is still queued/processing: the Analysing card, then a refresh into the result. */
export function RunningScan({ scanId }: { scanId: string }) {
  const router = useRouter();
  return <AnalysingCard scanId={scanId} onFinished={() => router.refresh()} />;
}

export const DELETE_SCAN_COPY = "It disappears from your history. Foods you logged from it stay in your diary. The scan still counts toward this month's 20.";

const ROUND = "grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink transition-colors hover:bg-sunken [&_svg]:size-5";

/**
 * The result's top bar (mock-c1 `.res-top`): Back (to the app page it came from, else History), the
 * title, and an overflow with "Delete scan". Deleting (DELETE /api/v1/scans/:id, a soft delete) asks
 * first with the spec §6.6 dialog; a deleted scan still counts toward the month, and the copy says so.
 */
export function ResultTopBar({ scanId, title }: { scanId: string; title: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [menu, setMenu] = useState(false);
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
  const back = () => {
    const action = backAction(readInAppNav(), "/history");
    if (action.kind === "back") router.back();
    else router.push(action.href);
  };

  return (
    <div className="flex items-center justify-between gap-2.5">
      <button type="button" onClick={back} aria-label="Back" className={ROUND}>
        <ChevronLeft aria-hidden />
      </button>
      <p className="m-0 min-w-0 truncate text-[17px] font-semibold whitespace-nowrap text-ink">{title}</p>
      <Popover.Root open={menu} onOpenChange={setMenu}>
        <Popover.Trigger aria-label="More actions" className={ROUND}>
          <Ellipsis aria-hidden />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
            <Popover.Popup className="min-w-[188px] origin-(--transform-origin) rounded-[18px] border border-line bg-surface p-1.5 text-ink shadow-card outline-none transition-[scale,opacity] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none">
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  setConfirm(true);
                }}
                className="flex min-h-11 w-full items-center gap-2.5 rounded-[12px] px-3 text-[14px] font-semibold whitespace-nowrap text-bad hover:bg-sunken"
              >
                <Trash2 className="size-[18px]" aria-hidden />
                Delete scan
              </button>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
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
  iconKey: FoodIconKey; grade: Grade | null; subtitle: string; flags: Flag[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  return (
    <>
      <div className="sticky bottom-0 z-10 -mx-4 mt-1 bg-[linear-gradient(180deg,transparent,var(--bg)_30%)] px-[18px] pt-3 pb-[calc(22px+env(safe-area-inset-bottom))] md:mx-0 md:px-0 md:pb-5 lg:w-[calc((100%-16px)*0.525)]">
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
      </div>
      <ResponsiveSheet open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-3">
          <FoodIcon iconKey={iconKey} size="lg" tone="brand" />
          <div className="min-w-0 flex-1 leading-tight">
            <SheetTitle className="block truncate text-[18px] font-semibold tracking-[-0.02em] text-ink">{food.name}</SheetTitle>
            <span className="block truncate text-[13px] text-subtle">{subtitle}</span>
          </div>
          <GradeBadge grade={grade} size="md" />
        </div>
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
