"use client";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Dumbbell, Plus, Timer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ResponsiveSheet, SheetTitle } from "@/components/ui/responsive-sheet";
import { IconTile } from "@/components/ui/icon-tile";
import { AmountStepper } from "@/components/food/amount-stepper";
import { DRAFT_EVENT } from "@/components/fitness/resume-banner";
import { SessionHeader } from "@/components/fitness/session/session-header";
import { ExerciseCard } from "@/components/fitness/session/exercise-card";
import { AddExerciseSheet } from "@/components/fitness/session/add-exercise-sheet";
import { api } from "@/lib/api-client";
import { todayIn } from "@/lib/dates";
import { customExerciseKey } from "@/lib/fitness/catalogue";
import { draftKey, draftReducer, elapsedMinutes, restoreDraft, startDraft, toCreateBody, type Draft, type DraftAction, type DraftExercise } from "@/lib/fitness/draft";
import type { Preset, PreviousSets, WorkoutDetail } from "@/lib/fitness/types";

/** Past this many minutes, Finish asks for the real duration instead of using the elapsed time. */
const STALE_MIN = 240;

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage is full or blocked; the session still works, it just won't survive a reload.
  }
}
function removeStored(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage is unavailable; nothing to remove.
  }
  window.dispatchEvent(new Event(DRAFT_EVENT));
}

/** The key a draft exercise's history is stored under (custom ones by their name's slug). */
export const historyKey = (e: DraftExercise) => e.exerciseKey ?? customExerciseKey(e.name);

/**
 * The session's exercise cards, "Add exercise" and its sheet; shared by the live session and the
 * edit screen. `previous` is each history key's sets from the last workout (omitted when editing).
 */
export function SessionExercises({ draft, previous, dispatch }: { draft: Draft; previous?: PreviousSets; dispatch: (a: DraftAction) => void }) {
  const [adding, setAdding] = useState(false);
  return (
    <>
      {draft.exercises.map((e, i) => (
        <ExerciseCard
          key={e.id}
          exercise={e}
          previous={previous?.[historyKey(e)]}
          isFirst={i === 0}
          isLast={i === draft.exercises.length - 1}
          dispatch={dispatch}
        />
      ))}
      {draft.exercises.length === 0 && (
        <p className="m-0 px-1 py-6 text-center text-[14px] text-subtle">No exercises yet. Add one to start logging sets.</p>
      )}

      <Button type="button" variant="ghost-sunken" shape="pill" size="lg" className="w-full" onClick={() => setAdding(true)}>
        <Plus aria-hidden />
        Add exercise
      </Button>

      <AddExerciseSheet
        open={adding}
        onOpenChange={setAdding}
        onPick={(exerciseKey, name) => {
          dispatch({ type: "addExercise", exerciseKey, name });
          setAdding(false);
        }}
      />
    </>
  );
}

const noopSubscribe = () => () => {};

type Props = { userId: string; timezone: string; requested: Preset | null | undefined };

/**
 * /workouts/session (spec §C screen 2). Renders only in the browser, since the draft lives in
 * localStorage: the server and the first client render show nothing, then the session mounts with
 * its draft restored (or started).
 */
export function LiveSession(props: Props) {
  const client = useSyncExternalStore(noopSubscribe, () => true, () => false);
  return client ? <Session {...props} /> : null;
}

function Session({ userId, timezone, requested }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const key = draftKey(userId);
  const fresh = (preset: Preset | null) => startDraft({ preset, startedAt: new Date().toISOString(), date: todayIn(timezone) });

  // A stored draft resumes; if the link asked for a different preset, ask first (it stays on screen meanwhile).
  const [init] = useState(() => {
    const stored = restoreDraft(readStored(key));
    if (!stored) return { draft: fresh(requested ?? null), conflict: false };
    return { draft: stored, conflict: requested !== undefined && requested !== stored.preset };
  });
  const [draft, setDraft] = useState<Draft>(init.draft);
  const [conflict, setConflict] = useState(init.conflict);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once the draft is saved or discarded, so the persist effect doesn't write it back.
  const closed = useRef(false);

  const dispatch = (a: DraftAction) => {
    setError(null);
    setDraft((d) => draftReducer(d, a));
  };

  useEffect(() => {
    if (!closed.current) writeStored(key, JSON.stringify(draft));
  }, [key, draft]);

  const keys = useMemo(() => [...new Set(draft.exercises.map(historyKey))].sort().slice(0, 30), [draft.exercises]);
  const previous = useQuery({
    queryKey: ["fitness", "previous", keys.join(",")],
    queryFn: () => api<{ previous: PreviousSets }>(`/api/v1/workouts/previous?keys=${keys.map(encodeURIComponent).join(",")}`),
    enabled: keys.length > 0,
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });

  const save = useMutation({
    mutationFn: (body: ReturnType<typeof toCreateBody>) => api<{ workout: WorkoutDetail }>("/api/v1/workouts", { method: "POST", body: JSON.stringify(body) }).then((r) => r.workout),
    onSuccess: (w) => {
      closed.current = true;
      removeStored(key);
      void qc.invalidateQueries({ queryKey: ["fitness"] });
      toast.success("Workout saved");
      router.replace(`/workouts/${w.id}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn’t save the workout. Try again."),
  });

  // A session left open for hours (forgotten, then resumed later) would otherwise save as a 10-hour
  // workout: past STALE_MIN, Finish asks how long the training actually took.
  const [askMinutes, setAskMinutes] = useState<number | null>(null);
  const finish = () => {
    const body = toCreateBody(draft);
    if (body.exercises.length === 0) {
      setError("Log at least one set");
      return;
    }
    if (elapsedMinutes(draft) > STALE_MIN) {
      setAskMinutes(60);
      return;
    }
    save.mutate(body);
  };
  const finishWith = (minutes: number) => {
    setAskMinutes(null);
    save.mutate({ ...toCreateBody(draft), durationMin: minutes });
  };

  const discard = () => {
    closed.current = true;
    removeStored(key);
    setConfirmDiscard(false);
    router.replace("/workouts/new");
  };

  const resolveConflict = (startNew: boolean) => {
    if (startNew) setDraft(fresh(requested ?? null));
    setConflict(false);
    // Drop ?preset= so a reload resumes instead of asking again.
    router.replace("/workouts/session");
  };

  return (
    <div data-no-phone-nav className="mx-auto flex w-full max-w-[720px] flex-col gap-3">
      <SessionHeader draft={draft} saving={save.isPending} onClose={() => setConfirmDiscard(true)} onFinish={finish} />
      {error && (
        <p role="alert" className="m-0 rounded-[14px] bg-bad/12 px-3.5 py-2.5 text-[13.5px] font-semibold text-bad">
          {error}
        </p>
      )}

      <SessionExercises draft={draft} previous={previous.data?.previous} dispatch={dispatch} />

      <ResponsiveSheet open={askMinutes !== null} onOpenChange={(open) => { if (!open) setAskMinutes(null); }}>
        <div className="flex items-center gap-3">
          <IconTile tone="brand" size="lg"><Timer /></IconTile>
          <div className="min-w-0 flex-1 leading-tight">
            <SheetTitle className="block truncate text-[18px] font-semibold tracking-[-0.02em] text-ink">How long did you train?</SheetTitle>
            <span className="block truncate text-[13px] text-subtle">This session was open for {Math.floor(elapsedMinutes(draft) / 60)} h</span>
          </div>
        </div>
        <AmountStepper
          amount={askMinutes ?? 60}
          sub="minutes"
          onStep={(dir) => setAskMinutes((m) => Math.min(600, Math.max(5, (m ?? 60) + dir * 5)))}
          canDecrease={(askMinutes ?? 60) > 5}
          canIncrease={(askMinutes ?? 60) < 600}
        />
        <Button type="button" shape="pill" size="xl" className="h-[54px] w-full" onClick={() => finishWith(askMinutes ?? 60)}>
          <Check aria-hidden />
          Save workout
        </Button>
      </ResponsiveSheet>
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        icon={<Trash2 />}
        title="Discard this session?"
        body="The sets you’ve logged so far won’t be saved."
        cancelLabel="Keep"
        confirmLabel="Discard"
        onConfirm={discard}
      />
      <ConfirmDialog
        open={conflict}
        onOpenChange={(open) => { if (!open) resolveConflict(false); }}
        icon={<Dumbbell />}
        confirmIcon={<Plus />}
        title="You have a session in progress"
        body={`${draft.title} is still open. Starting a new one discards it.`}
        cancelLabel="Resume it"
        confirmLabel="Start new"
        onConfirm={() => resolveConflict(true)}
      />
    </div>
  );
}
