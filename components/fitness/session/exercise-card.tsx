"use client";
import { parseAmount } from "@/lib/parse-amount";
import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";
import { OverflowMenu, type OverflowItem } from "@/components/ui/overflow-menu";
import { bestSet } from "@/lib/fitness/stats";
import { cn } from "@/lib/utils";
import type { DraftAction, DraftExercise, DraftSet } from "@/lib/fitness/draft";
import type { WorkoutSet } from "@/lib/fitness/types";

// Set · Previous · kg · Reps · tick · row menu. Fits one line in a 360 px viewport.
const ROW = "grid grid-cols-[22px_minmax(0,1fr)_60px_48px_44px_28px] items-center gap-1.5 rounded-[10px] px-1";
const kg = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

/** "60 × 8", "× 8", "60 kg" or "–". */
function prevLabel(s: WorkoutSet | undefined): string {
  if (!s || (s.weightKg === null && s.reps === null)) return "–";
  if (s.weightKg !== null && s.reps !== null) return `${kg(s.weightKg)} × ${s.reps}`;
  return s.weightKg !== null ? `${kg(s.weightKg)} kg` : `× ${s.reps}`;
}

/** A compact numeric field: a 32 px tile inside a 44 px tap area. Keeps its own text so "62." survives. */
function NumberCell({ value, decimal, label, onChange }: { value: number | null; decimal: boolean; label: string; onChange: (v: number | null) => void }) {
  const [text, setText] = useState(value === null ? "" : String(value));
  return (
    <div className="relative h-11">
      <input
        type="text"
        inputMode={decimal ? "decimal" : "numeric"}
        autoComplete="off"
        enterKeyHint="next"
        aria-label={label}
        maxLength={decimal ? 6 : 3}
        value={text}
        onChange={(e) => {
          // Keep only what an amount can contain, then read it with the shared parser (decimal comma rules).
          const t = decimal ? e.target.value.replace(/[^\d.,]/g, "") : e.target.value.replace(/\D/g, "");
          setText(t);
          const n = parseAmount(t);
          onChange(n !== null && Number.isFinite(n) ? (decimal ? n : Math.round(n)) : null);
        }}
        className="peer relative z-[1] h-11 w-full min-w-0 bg-transparent text-center text-[14px] font-semibold text-ink outline-none! placeholder:text-subtle"
      />
      <span aria-hidden className="absolute inset-x-0 inset-y-1.5 rounded-[9px] bg-sunken peer-focus-visible:ring-2 peer-focus-visible:ring-ring" />
    </div>
  );
}

function SetRow({ n, set, prev, exerciseId, exerciseName, dispatch }: {
  n: number; set: DraftSet; prev: WorkoutSet | undefined; exerciseId: string; exerciseName: string; dispatch: (a: DraftAction) => void;
}) {
  const update = (patch: Partial<Pick<DraftSet, "weightKg" | "reps">>) => dispatch({ type: "updateSet", exerciseId, setId: set.id, patch });
  return (
    <div role="group" aria-label={`${exerciseName}, set ${n}`} className={cn(ROW, "min-h-11 text-[14px]", set.done && "bg-brand/12")}>
      <span className="num text-center font-semibold text-ink">{n}</span>
      <span className="num truncate text-[13px] whitespace-nowrap text-subtle">{prevLabel(prev)}</span>
      <NumberCell value={set.weightKg} decimal label={`Set ${n} weight, kg`} onChange={(weightKg) => update({ weightKg })} />
      <NumberCell value={set.reps} decimal={false} label={`Set ${n} reps`} onChange={(reps) => update({ reps })} />
      <button
        type="button"
        aria-label={`Set ${n} done`}
        aria-pressed={set.done}
        onClick={() => dispatch({ type: "toggleDone", exerciseId, setId: set.id })}
        className="group grid size-11 place-items-center rounded-[10px]"
      >
        <span className="grid size-8 place-items-center rounded-[9px] bg-sunken text-subtle transition-colors group-aria-pressed:bg-brand group-aria-pressed:text-brand-ink [&_svg]:size-4">
          <Check aria-hidden />
        </span>
      </button>
      <OverflowMenu
        label={`Set ${n} actions`}
        triggerClassName="-mr-2.5 -ml-1.5 size-11 rounded-[10px] border-0 bg-transparent text-subtle [&_svg]:size-4"
        items={[{ label: "Remove set", icon: <Trash2 />, tone: "danger", onSelect: () => dispatch({ type: "removeSet", exerciseId, setId: set.id }) }]}
      />
    </div>
  );
}

/** One exercise in the live session (mock-c1 `.ex`): name, last best, overflow, the set table and "Add set". */
export function ExerciseCard({ exercise, previous, isFirst, isLast, dispatch }: {
  exercise: DraftExercise; previous: WorkoutSet[] | undefined; isFirst: boolean; isLast: boolean; dispatch: (a: DraftAction) => void;
}) {
  const prevSets = previous ? [...previous].sort((a, b) => a.position - b.position) : [];
  const best = bestSet(prevSets);
  const id = exercise.id;
  const menu: OverflowItem[] = [
    ...(isFirst ? [] : [{ label: "Move up", icon: <ArrowUp />, onSelect: () => dispatch({ type: "moveExercise", exerciseId: id, dir: -1 }) }]),
    ...(isLast ? [] : [{ label: "Move down", icon: <ArrowDown />, onSelect: () => dispatch({ type: "moveExercise", exerciseId: id, dir: 1 }) }]),
    { label: "Remove exercise", icon: <Trash2 />, tone: "danger", onSelect: () => dispatch({ type: "removeExercise", exerciseId: id }) },
  ];

  return (
    <section aria-label={exercise.name} className="grid gap-1 rounded-[20px] bg-surface px-3 pt-2 pb-3 shadow-card">
      <div className="flex min-h-11 items-center gap-2 pl-1">
        <h2 className="m-0 min-w-0 flex-1 truncate text-[15px] font-semibold whitespace-nowrap text-brand-deep">{exercise.name}</h2>
        {best && <span className="num shrink-0 text-[12px] whitespace-nowrap text-subtle">Last: {kg(best.weightKg)} kg × {best.reps}</span>}
        <OverflowMenu label={`${exercise.name} actions`} triggerClassName="-mr-1.5 border-0 bg-transparent text-subtle [&_svg]:size-[18px]" items={menu} />
      </div>
      <div aria-hidden className={cn(ROW, "min-h-6 text-[11px] font-semibold tracking-[.05em] whitespace-nowrap text-subtle uppercase")}>
        <span className="text-center">Set</span>
        <span>Previous</span>
        <span className="text-center">kg</span>
        <span className="text-center">Reps</span>
        <span />
        <span />
      </div>
      {exercise.sets.map((s, i) => (
        <SetRow key={s.id} n={i + 1} set={s} prev={prevSets[i]} exerciseId={id} exerciseName={exercise.name} dispatch={dispatch} />
      ))}
      <button
        type="button"
        onClick={() => dispatch({ type: "addSet", exerciseId: id })}
        className="mt-1 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] bg-sunken text-[13.5px] font-semibold whitespace-nowrap text-ink transition-colors hover:bg-line [&_svg]:size-4"
      >
        <Plus aria-hidden />
        Add set
      </button>
    </section>
  );
}
