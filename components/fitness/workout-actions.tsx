"use client";
// The saved workout summary's top bar (spec §C screen 3): Back, "Workout", and an overflow with Edit
// (the session editor for a gym session, the pre-filled activity sheet otherwise) and Delete.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BackButton } from "@/components/nav/back-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { OverflowMenu } from "@/components/ui/overflow-menu";
import { ActivityEditSheet } from "@/components/fitness/activity-sheet";
import { api, ApiError } from "@/lib/api-client";
import type { WorkoutDetail } from "@/lib/fitness/types";

export const DELETE_WORKOUT_COPY = "It's removed from your history and this week's totals.";

export function WorkoutTopBar({ workout }: { workout: WorkoutDetail }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [session, setSession] = useState(0);

  const del = useMutation({
    mutationFn: async () => {
      try {
        await api(`/api/v1/workouts/${workout.id}`, { method: "DELETE" });
      } catch (e) {
        // Already gone (a second tap, or deleted in another tab) is the outcome the user wanted.
        if (!(e instanceof ApiError && e.status === 404)) throw e;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fitness"] });
      toast.success("Workout deleted");
      router.replace("/progress?view=fitness");
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn’t delete that. Try again."),
  });

  const edit = workout.kind === "gym"
    ? { label: "Edit", icon: <Pencil />, href: `/workouts/${workout.id}/edit` }
    : { label: "Edit", icon: <Pencil />, onSelect: () => { setSession((n) => n + 1); setEditing(true); } };

  return (
    <div className="flex items-center justify-between gap-2.5">
      <BackButton fallback="/today" />
      <p className="m-0 min-w-0 truncate text-[17px] font-semibold whitespace-nowrap text-ink">Workout</p>
      <OverflowMenu items={[edit, { label: "Delete", icon: <Trash2 />, tone: "danger", onSelect: () => setConfirm(true) }]} />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        icon={<Trash2 />}
        title="Delete this workout?"
        body={DELETE_WORKOUT_COPY}
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        pending={del.isPending}
        onConfirm={() => del.mutate()}
      />
      {workout.kind === "activity" && <ActivityEditSheet workout={workout} session={session} open={editing} onOpenChange={setEditing} />}
    </div>
  );
}
