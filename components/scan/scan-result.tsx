"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { AddToMeal, type LoggableFood } from "@/components/food/add-to-meal";
import type { Meal } from "@/lib/nutrition/types";
import { ScanProgress } from "./scan-progress";

/** /scans/[id] while the scan is still queued/processing: the progress screen, then a refresh into the result. */
export function RunningScan({ scanId }: { scanId: string }) {
  const router = useRouter();
  return <ScanProgress scanId={scanId} onFinished={() => router.refresh()} />;
}

/** Add to meal from the scan's own result (log kinds scan / scan_grams); goes to that day afterwards. */
export function AddScanToMeal({ scanId, food, date, defaultMeal, isToday }: {
  scanId: string; food: LoggableFood; date: string; defaultMeal: Meal; isToday: boolean;
}) {
  const router = useRouter();
  return (
    <AddToMeal food={food} target={{ kind: "scan", scanId }} date={date} defaultMeal={defaultMeal}
      onDone={() => router.push(isToday ? "/today" : `/today?date=${date}`)} />
  );
}

/** "Save to my foods": a private custom food copied from the scan (POST /foods { fromScanId }). */
export function SaveScanToFoods({ scanId }: { scanId: string }) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: () => api<{ food: { id: string } }>("/api/v1/foods", { method: "POST", body: JSON.stringify({ fromScanId: scanId }) }),
    onSuccess: () => {
      toast.success("Saved to My foods. It will show up in search.");
      void qc.invalidateQueries({ queryKey: ["foods"] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't save that. Try again."),
  });
  if (save.data) {
    return (
      <Link href={`/foods/${save.data.food.id}`}
        className="flex min-h-12 items-center justify-center rounded-lg border border-line bg-surface px-4 font-semibold text-accent">
        Saved — open in My foods
      </Link>
    );
  }
  return (
    <Button variant="outline" className="h-12 w-full text-base" disabled={save.isPending} onClick={() => save.mutate()}>
      {save.isPending ? "Saving…" : "Save to my foods"}
    </Button>
  );
}

/**
 * Delete this scan (DELETE /api/v1/scans/:id), with a confirmation dialog — no `confirm()`. A
 * deleted scan still counts toward this month's credit and limit totals, so the confirmation copy
 * never promises a credit back. On success: toast, invalidate the history list, replace to /history.
 */
export function DeleteScanButton({ scanId }: { scanId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
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
    <>
      <Button type="button" variant="outline" className="h-11 w-full gap-1.5 text-sm" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" aria-hidden /> Delete scan
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Delete this scan?</DialogTitle>
          <DialogDescription>{"It will be removed from your history. It still counts toward this month's AI scan usage."}</DialogDescription>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" className="h-11" />}>Cancel</DialogClose>
            <Button type="button" variant="destructive" className="h-11" disabled={del.isPending} onClick={() => del.mutate()}>
              {del.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
