"use client";
import { useState } from "react";
import { History } from "lucide-react";
import { toast } from "sonner";
import { WorkoutRow } from "@/components/fitness/workout-row";
import { api } from "@/lib/api-client";
import type { HistoryPage, WorkoutListItem } from "@/lib/fitness/types";
import { cn } from "@/lib/utils";

const CARD = "rounded-[24px] bg-surface shadow-card";

/**
 * Every visible workout, newest first (workouts-full-v3.html "History"): the server's first page, then
 * "Show more" pages in 20 at a time through GET /api/v1/workouts/history?cursor=. Hidden once there's
 * no next page.
 */
export function HistoryList({ initial, className }: { initial: HistoryPage; className?: string }) {
  const [items, setItems] = useState<WorkoutListItem[]>(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [pending, setPending] = useState(false);

  async function showMore() {
    if (!cursor || pending) return;
    setPending(true);
    try {
      const page = await api<HistoryPage>(`/api/v1/workouts/history?cursor=${encodeURIComponent(cursor)}`);
      setItems((cur) => [...cur, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      toast.error("Couldn’t load more. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="wk-history" className={cn(CARD, "grid min-w-0 content-start gap-1.5 px-4 py-3.5 md:px-5", className)}>
      <h2 id="wk-history" className="m-0 inline-flex items-center gap-[7px] text-[15px] font-semibold whitespace-nowrap text-ink">
        <History className="size-[18px] shrink-0 text-brand-deep" aria-hidden />
        History
      </h2>
      {items.length === 0 ? (
        <p className="m-0 truncate text-[13.5px] text-subtle">No workouts yet. Log one to see it here.</p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-0.5 p-0">
          {items.map((w) => (
            <li key={w.id}><WorkoutRow w={w} /></li>
          ))}
        </ul>
      )}
      {cursor && (
        <button
          type="button"
          onClick={() => void showMore()}
          disabled={pending}
          className="mx-auto mt-1 inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-sunken px-5 text-[13.5px] font-semibold whitespace-nowrap text-ink hover:bg-line disabled:opacity-50"
        >
          {pending ? "Loading…" : "Show more"}
        </button>
      )}
    </section>
  );
}
