"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Check, Loader2, Plus, Scale, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BackButton } from "@/components/nav/back-button";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ResponsiveSheet, SheetTitle } from "@/components/ui/responsive-sheet";
import { IconTile } from "@/components/ui/icon-tile";
import { AmountStepper } from "@/components/food/amount-stepper";
import { WeightLine } from "@/components/fitness/weight/charts";
import { api } from "@/lib/api-client";
import { addDays } from "@/lib/dates";
import { DECIMAL_COMMA_MESSAGE, parseAmount } from "@/lib/parse-amount";
import { dayMonth, weekdayShort } from "@/lib/progress/copy";
import { fmtChange, fmtWeight, trendPoints } from "@/lib/fitness/weight-view";
import type { WeightEntry, WeightHistory } from "@/lib/fitness/types";

const MIN = 20;
const MAX = 400;
const CARD = "rounded-[24px] bg-surface shadow-card";
const round1 = (n: number) => Math.round(n * 10) / 10;

function dayText(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  return `${weekdayShort(date)}, ${dayMonth(date)}`;
}

/** The Log weight sheet's form: a 0.1 kg stepper (the number can be typed, "72,4" too) and the date. */
function LogForm({ start, today, onDone }: { start: number; today: string; onDone: () => void }) {
  const router = useRouter();
  const [text, setText] = useState(fmtWeight(start));
  const [date, setDate] = useState(today);
  const parsed = parseAmount(text);
  const kg = parsed === null || Number.isNaN(parsed) ? null : round1(parsed);
  const valid = kg !== null && kg >= MIN && kg <= MAX && date !== "" && date <= today;
  const error = /^\d+,\d{2}$/.test(text.replace(/\s/g, "")) ? DECIMAL_COMMA_MESSAGE : kg !== null && (kg < MIN || kg > MAX) ? `Enter ${MIN}–${MAX} kg` : text && kg === null ? "Enter a number" : null;

  const save = useMutation({
    mutationFn: () => api<{ entry: WeightEntry }>("/api/v1/weight", { method: "POST", body: JSON.stringify({ date, kg }) }),
    onSuccess: ({ entry }) => {
      toast.success(`${fmtWeight(entry.kg)} kg logged`);
      onDone();
      router.refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn’t log that. Try again."),
  });

  const step = (dir: 1 | -1) => setText(fmtWeight(Math.min(MAX, Math.max(MIN, round1((kg ?? start) + dir * 0.1)))));

  return (
    <>
      <div className="flex items-center gap-3">
        <IconTile tone="brand" size="md"><Scale /></IconTile>
        <div className="min-w-0 flex-1 leading-tight">
          <SheetTitle className="block truncate text-[18px] font-semibold tracking-[-0.02em] text-ink">Log weight</SheetTitle>
          <span className="block truncate text-[13px] text-subtle">One entry a day; logging again replaces it</span>
        </div>
      </div>
      <AmountStepper
        amount={kg ?? start}
        sub={error ? <span className="text-bad">{error}</span> : "kg"}
        onStep={step}
        canDecrease={(kg ?? start) > MIN}
        canIncrease={(kg ?? start) < MAX}
        input={{ value: text, onChange: setText, invalid: !!error, label: "Weight, kg" }}
      />
      <label className="flex min-h-12 items-center justify-between gap-3 rounded-[16px] bg-sunken px-4">
        <span className="text-[14px] font-semibold whitespace-nowrap text-ink">Date</span>
        <input
          type="date"
          value={date}
          max={today}
          min={addDays(today, -365)}
          onChange={(e) => setDate(e.target.value)}
          className="num min-h-11 min-w-0 bg-transparent text-right text-[14px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand-deep"
        />
      </label>
      <Button type="button" shape="pill" size="xl" className="h-[54px] w-full" disabled={!valid || save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Check aria-hidden />}
        {save.isPending ? "Saving…" : "Log weight"}
      </Button>
    </>
  );
}

/**
 * /weight (spec §C screen 7): the latest weight with its 30-day change, the trend (EvilCharts line) with
 * the goal as a reference line, the recent entries (each deletable behind a confirm) and Log weight.
 */
export function WeightLog({ history, today }: { history: WeightHistory; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const [doomed, setDoomed] = useState<WeightEntry | null>(null);
  const points = trendPoints(history.entries);
  const goal = history.goalWeightKg;
  const change = fmtChange(history.change30d);

  const remove = useMutation({
    mutationFn: (date: string) => api<void>(`/api/v1/weight/${date}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Entry deleted");
      setDoomed(null);
      router.refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn’t delete that. Try again."),
  });

  const openLog = () => {
    setSession((n) => n + 1);
    setOpen(true);
  };

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-3">
      <div className="flex items-center justify-between gap-2.5">
        <BackButton fallback="/workouts" />
        <h1 className="m-0 min-w-0 truncate text-[17px] font-semibold whitespace-nowrap text-ink">Weight</h1>
        <span className="size-11 shrink-0" aria-hidden />
      </div>

      <section aria-label="Current weight" className={`${CARD} grid gap-3 px-4 py-4 md:px-5`}>
        {history.latest ? (
          <div className="flex min-w-0 flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <div className="min-w-0">
              <span className="block text-[12px] font-semibold tracking-[0.06em] whitespace-nowrap text-subtle uppercase">Current</span>
              <b className="num mt-1 block text-[40px] leading-none font-[650] tracking-[-0.045em] whitespace-nowrap text-ink">
                {fmtWeight(history.latest.kg)}
                <small className="ml-1 text-[15px] font-medium tracking-normal text-subtle">kg</small>
              </b>
            </div>
            <div className="num grid justify-items-end text-[13px] leading-snug whitespace-nowrap text-subtle">
              {change && <span><b className="font-semibold text-ink">{change}</b> in 30 days</span>}
              {goal !== null && <span>Goal <b className="font-semibold text-ink">{fmtWeight(goal)} kg</b></span>}
            </div>
          </div>
        ) : (
          <p className="m-0 text-[14px] text-subtle">No weight logged yet. Log one to start the trend.</p>
        )}
        {points.length >= 2 && (
          <div className="h-[200px] md:h-[240px]" role="img" aria-label={`Weight over the last 30 days, from ${fmtWeight(points[0]!.kg)} to ${fmtWeight(points.at(-1)!.kg)} kg${goal !== null ? `, goal ${fmtWeight(goal)} kg` : ""}.`}>
            <WeightLine points={points} goal={goal} />
          </div>
        )}
        {goal !== null && points.length >= 2 && (
          <span className="inline-flex items-center gap-2 text-[12.5px] whitespace-nowrap text-subtle" aria-hidden>
            <i className="block w-4 border-t-[1.5px] border-dashed border-ok" />
            Goal {fmtWeight(goal)} kg
          </span>
        )}
      </section>

      <Button type="button" shape="pill" size="xl" className="h-[54px] w-full" aria-haspopup="dialog" onClick={openLog}>
        <Plus aria-hidden />
        Log weight
      </Button>

      {history.entries.length > 0 && (
        <section aria-labelledby="weight-recent" className={`${CARD} grid gap-1 px-4 py-3.5 md:px-5`}>
          <h2 id="weight-recent" className="m-0 text-[15px] font-semibold whitespace-nowrap text-ink">Recent entries</h2>
          <ul className="m-0 grid list-none p-0">
            {history.entries.slice(0, 14).map((e) => (
              <li key={e.date} className="flex min-h-12 items-center gap-3 border-line not-first:border-t">
                <span className="min-w-0 flex-1 truncate text-[14px] whitespace-nowrap text-ink">{dayText(e.date, today)}</span>
                <b className="num shrink-0 text-[14.5px] font-semibold whitespace-nowrap text-ink">{fmtWeight(e.kg)} kg</b>
                <button
                  type="button"
                  aria-label={`Delete ${dayText(e.date, today)}, ${fmtWeight(e.kg)} kg`}
                  onClick={() => setDoomed(e)}
                  className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-subtle transition-colors hover:bg-sunken hover:text-bad"
                >
                  <Trash2 className="size-[18px]" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ResponsiveSheet open={open} onOpenChange={setOpen}>
        <LogForm key={session} start={history.latest?.kg ?? 70} today={today} onDone={() => setOpen(false)} />
      </ResponsiveSheet>
      <ConfirmDialog
        open={doomed !== null}
        onOpenChange={(o) => !o && setDoomed(null)}
        icon={<Trash2 aria-hidden />}
        title="Delete this entry?"
        body={doomed ? `${fmtWeight(doomed.kg)} kg on ${dayText(doomed.date, today)} will be removed.` : ""}
        confirmLabel="Delete"
        pending={remove.isPending}
        pendingLabel="Deleting…"
        onConfirm={() => doomed && remove.mutate(doomed.date)}
      />
    </div>
  );
}
