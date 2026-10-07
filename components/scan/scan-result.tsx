"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
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
