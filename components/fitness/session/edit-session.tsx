"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AmountStepper } from "@/components/food/amount-stepper";
import { SessionHeader } from "@/components/fitness/session/session-header";
import { SessionExercises } from "@/components/fitness/session/live-session";
import { api } from "@/lib/api-client";
import { draftReducer, toUpdateBody, type Draft, type DraftAction } from "@/lib/fitness/draft";
import type { WorkoutDetail } from "@/lib/fitness/types";

const MAX = 600;
const STEP = 5;

/**
 * /workouts/{id}/edit: a saved gym session in the live session's editor, without the timer. The
 * minutes are a field instead, Save PATCHes the workout and returns to its summary. It never reads
 * or writes the localStorage draft, so a session in progress is left alone.
 */
export function EditSession({ workoutId, initial, durationMin }: { workoutId: string; initial: Draft; durationMin: number }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(initial);
  const [minutesText, setMinutesText] = useState(String(durationMin));
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const minutes = /^\d{1,3}$/.test(minutesText) ? Number(minutesText) : NaN;
  const minutesValid = Number.isInteger(minutes) && minutes >= 0 && minutes <= MAX;
  const dirty = draft !== initial || minutesText !== String(durationMin);
  const summary = `/workouts/${workoutId}`;

  const dispatch = (a: DraftAction) => {
    setError(null);
    setDraft((d) => draftReducer(d, a));
  };
  const stepMinutes = (dir: 1 | -1) => {
    setError(null);
    const base = minutesValid ? minutes : durationMin;
    setMinutesText(String(Math.min(MAX, Math.max(0, base + dir * STEP))));
  };

  const save = useMutation({
    mutationFn: (body: ReturnType<typeof toUpdateBody>) =>
      api<{ workout: WorkoutDetail }>(`/api/v1/workouts/${workoutId}`, { method: "PATCH", body: JSON.stringify(body) }).then((r) => r.workout),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fitness"] });
      toast.success("Workout updated");
      router.replace(summary);
      router.refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn’t save the workout. Try again."),
  });

  const submit = () => {
    if (!minutesValid) {
      setError(`Minutes must be 0–${MAX}`);
      return;
    }
    const body = toUpdateBody(draft, minutes);
    if (body.exercises.length === 0) {
      setError("Log at least one set");
      return;
    }
    save.mutate(body);
  };

  const cancel = () => (dirty ? setConfirmCancel(true) : router.replace(summary));

  return (
    <div data-no-phone-nav className="mx-auto flex w-full max-w-[720px] flex-col gap-3">
      <SessionHeader mode="edit" draft={draft} saving={save.isPending} onClose={cancel} onFinish={submit} />
      {error && (
        <p role="alert" className="m-0 rounded-[14px] bg-bad/12 px-3.5 py-2.5 text-[13.5px] font-semibold text-bad">
          {error}
        </p>
      )}

      <AmountStepper
        amount={minutesValid ? minutes : 0}
        sub="minutes"
        onStep={stepMinutes}
        canDecrease={!minutesValid || minutes > 0}
        canIncrease={!minutesValid || minutes < MAX}
        input={{
          value: minutesText,
          onChange: (v) => {
            setError(null);
            setMinutesText(v.replace(/\D/g, "").slice(0, 3));
          },
          invalid: !minutesValid,
          label: "Duration, minutes",
        }}
      />

      <SessionExercises draft={draft} dispatch={dispatch} />

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        icon={<Undo2 />}
        title="Discard your changes?"
        body="The workout stays as it was saved."
        cancelLabel="Keep editing"
        confirmLabel="Discard"
        onConfirm={() => {
          setConfirmCancel(false);
          router.replace(summary);
        }}
      />
    </div>
  );
}
