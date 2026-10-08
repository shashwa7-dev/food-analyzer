"use client";
import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Dumbbell, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { draftKey, elapsedMinutes, restoreDraft } from "@/lib/fitness/draft";

/** Fired on this tab when the draft is removed here (the "storage" event only reaches other tabs). */
export const DRAFT_EVENT = "eatri8-workout-draft";

function readDraft(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function subscribeDraft(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(DRAFT_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(DRAFT_EVENT, onChange);
  };
}

/** The current minute, re-read every 30 s so the elapsed count keeps up. */
function subscribeClock(onChange: () => void) {
  const id = window.setInterval(onChange, 30_000);
  return () => window.clearInterval(id);
}
const currentMinute = () => Math.floor(Date.now() / 60_000);

/**
 * "Session in progress" (spec §C): a slim card shown while a gym session's draft sits in
 * localStorage, with Resume (back to /workouts/session) and Discard (confirmed, removes the draft).
 * Renders nothing on the server and when there's no valid draft.
 */
export function ResumeBanner({ userId }: { userId: string }) {
  const key = draftKey(userId);
  const raw = useSyncExternalStore(subscribeDraft, () => readDraft(key), () => null);
  const minute = useSyncExternalStore(subscribeClock, currentMinute, () => 0);
  const draft = useMemo(() => restoreDraft(raw), [raw]);
  const [confirm, setConfirm] = useState(false);
  if (!draft) return null;
  const elapsed = elapsedMinutes(draft, new Date(minute * 60_000));

  const discard = () => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage is unavailable; nothing to remove.
    }
    setConfirm(false);
    window.dispatchEvent(new Event(DRAFT_EVENT));
  };

  return (
    <section aria-label="Session in progress" className="flex min-h-[60px] items-center gap-2 rounded-[20px] bg-brand-soft py-2 pr-2 pl-3.5">
      <Dumbbell className="size-5 shrink-0 text-brand-deep" aria-hidden />
      {/* Two lines, so the title and elapsed time survive at phone width: "Session in progress" over "{title} · {n} min". */}
      <p className="m-0 min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[13.5px] font-semibold whitespace-nowrap text-ink">Session in progress</span>
        <span className="num block truncate text-[12.5px] whitespace-nowrap text-subtle">{draft.title} · {elapsed} min</span>
      </p>
      <button
        type="button"
        className="inline-flex min-h-11 shrink-0 items-center rounded-full px-2.5 text-[13.5px] font-semibold whitespace-nowrap text-subtle transition-colors hover:bg-surface"
        onClick={() => setConfirm(true)}
      >
        Discard
      </button>
      <Link
        href="/workouts/session"
        className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-action px-4 text-[13.5px] font-semibold whitespace-nowrap text-action-ink"
      >
        Resume
      </Link>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        icon={<Trash2 aria-hidden />}
        title="Discard this session?"
        body={`${draft.title} and every set you’ve entered will be lost.`}
        confirmLabel="Discard"
        onConfirm={discard}
      />
    </section>
  );
}
