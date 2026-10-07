"use client";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { invalidateLogQueries } from "@/lib/log/invalidate";
import { MEAL_META } from "@/components/food/meal-meta";
import type { Meal } from "@/lib/nutrition/types";

/**
 * POST /api/v1/log, then the toast "{name} added to {Meal}" with Undo, which deletes the entry it
 * just created (once, however fast Undo is tapped twice). Shared by search quick add and the add
 * sheet. Resolves to the new entry's id, or null when the add failed (the error is toasted).
 */
export function useLogEntry() {
  const router = useRouter();
  const qc = useQueryClient();
  return useCallback(async (body: Record<string, unknown>, { name, meal }: { name: string; meal: Meal }): Promise<string | null> => {
    const changed = () => {
      // Mark recents stale without refetching: a visible Recent list must not reorder under the
      // user's finger. It refetches the next time a Recent list mounts.
      void qc.invalidateQueries({ queryKey: ["foods", "recent"], refetchType: "none" });
      invalidateLogQueries(qc);
      router.refresh();
    };
    let id: string;
    try {
      id = (await api<{ entry: { id: string } }>("/api/v1/log", { method: "POST", body: JSON.stringify(body) })).entry.id;
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't add that. Try again.");
      return null;
    }
    changed();
    let undone = false;
    toast.success(`${name} added to ${MEAL_META[meal].label}`, {
      action: {
        label: <><Undo2 className="size-4" aria-hidden />Undo</>,
        onClick: () => {
          if (undone) return;
          undone = true;
          api(`/api/v1/log/${id}`, { method: "DELETE" }).then(
            () => { toast.success(`${name} removed`); changed(); },
            (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Couldn't undo that. Try again."),
          );
        },
      },
    });
    return id;
  }, [qc, router]);
}
