"use client";
import type { ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { formatAmount } from "@/lib/log/stepper";

const STEP = "grid size-12 shrink-0 place-items-center rounded-2xl bg-sunken text-ink transition-colors hover:bg-line disabled:opacity-40 disabled:hover:bg-sunken [&_svg]:size-[22px]";

/**
 * The sheets' amount control (mock-c1 `.qty`): 48 px − / + on --sunken around a 30 px number, with
 * "{unit} · {grams} g" underneath. `input` swaps the number for a text field (grams can be typed,
 * as in M1); stepping and limits stay with the caller.
 */
export function AmountStepper({ amount, sub, onStep, canDecrease, canIncrease, input }: {
  amount: number;
  sub: ReactNode;
  onStep: (dir: 1 | -1) => void;
  canDecrease: boolean;
  canIncrease: boolean;
  input?: { value: string; onChange: (value: string) => void; invalid: boolean; label: string };
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-[22px] bg-surface p-2 shadow-card">
      <button type="button" className={STEP} aria-label="Less" disabled={!canDecrease} onClick={() => onStep(-1)}>
        <Minus aria-hidden />
      </button>
      <div className="min-w-0 flex-1 text-center leading-[1.15]">
        {input ? (
          <input
            inputMode="decimal"
            aria-label={input.label}
            aria-invalid={input.invalid}
            value={input.value}
            onChange={(e) => input.onChange(e.target.value)}
            onFocus={(e) => e.target.select()}
            className="num mx-auto block w-full max-w-[9ch] rounded-[10px] bg-transparent text-center text-[30px] font-[650] tracking-[-0.04em] text-ink outline-none! focus-visible:ring-2 focus-visible:ring-brand-deep aria-invalid:text-bad"
          />
        ) : (
          <b className="num block text-[30px] font-[650] tracking-[-0.04em] text-ink" aria-live="polite">{formatAmount(amount)}</b>
        )}
        <span className="num block truncate text-[13px] text-subtle">{sub}</span>
      </div>
      <button type="button" className={STEP} aria-label="More" disabled={!canIncrease} onClick={() => onStep(1)}>
        <Plus aria-hidden />
      </button>
    </div>
  );
}
