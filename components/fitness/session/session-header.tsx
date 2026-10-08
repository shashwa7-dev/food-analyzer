"use client";
import { useSyncExternalStore } from "react";
import { Loader2, Timer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { doneSetCount, type Draft } from "@/lib/fitness/draft";

function subscribeSecond(onChange: () => void) {
  const id = window.setInterval(onChange, 1000);
  return () => window.clearInterval(id);
}
const currentSecond = () => Math.floor(Date.now() / 1000);

/** `mm:ss`, or `h:mm:ss` from an hour. */
export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

function LiveTimer({ startedAt }: { startedAt: string }) {
  const now = useSyncExternalStore(subscribeSecond, currentSecond, () => 0);
  const elapsed = now - Math.floor(new Date(startedAt).getTime() / 1000);
  return (
    <>
      <Timer aria-hidden />
      <span role="timer" aria-label="Elapsed time">{formatElapsed(elapsed)}</span>
    </>
  );
}

/**
 * X (discard), the title over "timer · N sets", and Finish (mock-c1 `.tb` on screen 2). In `edit` mode
 * (a saved workout at /workouts/{id}/edit) there is no timer: X cancels, the line reads "N sets" and
 * the action is Save.
 */
export function SessionHeader({ draft, saving, onClose, onFinish, mode = "live" }: {
  draft: Draft; saving: boolean; onClose: () => void; onFinish: () => void; mode?: "live" | "edit";
}) {
  const sets = doneSetCount(draft);
  const edit = mode === "edit";
  const setsLabel = `${sets} ${sets === 1 ? "set" : "sets"}`;

  return (
    <div className="flex items-center justify-between gap-2.5">
      <button
        type="button"
        aria-label={edit ? "Cancel editing" : "Discard session"}
        onClick={onClose}
        className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink transition-colors hover:bg-sunken [&_svg]:size-5"
      >
        <X aria-hidden />
      </button>
      <div className="min-w-0 text-center leading-[1.2]">
        <h1 className="m-0 truncate text-[17px] font-semibold whitespace-nowrap text-ink">{draft.title}</h1>
        <p className="num m-0 inline-flex items-center gap-1 text-[12.5px] whitespace-nowrap text-subtle [&_svg]:size-3.5">
          {edit ? <span>Editing</span> : <LiveTimer startedAt={draft.startedAt} />}
          <span aria-live="polite">· {setsLabel}</span>
        </p>
      </div>
      <Button type="button" shape="pill" className="h-11 shrink-0 px-4 text-[14px] font-semibold" disabled={saving} onClick={onFinish}>
        {saving && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />}
        {saving ? "Saving…" : edit ? "Save" : "Finish"}
      </Button>
    </div>
  );
}
