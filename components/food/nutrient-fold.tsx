"use client";
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Folds a long card grid on phones (< 900 px): the cards past the first few carry
 * `max-md:group-data-[folded=true]/fold:hidden` (components/food/result-parts.tsx NutrientGrid), and
 * "Show all {n}" opens them. Wide screens always show everything and never see the button.
 */
export function NutrientFold({ total, children }: { total: number; children: ReactNode }) {
  const [folded, setFolded] = useState(true);
  return (
    <div className="group/fold grid gap-2" data-folded={folded}>
      {children}
      <button
        type="button"
        aria-expanded={!folded}
        onClick={() => setFolded((f) => !f)}
        className="inline-flex min-h-11 items-center justify-center gap-1.5 justify-self-center rounded-full border border-line bg-surface px-4 text-[13.5px] font-semibold whitespace-nowrap text-ink md:hidden"
      >
        {folded ? `Show all ${total}` : "Show fewer"}
        <ChevronDown className={folded ? "size-4" : "size-4 rotate-180"} aria-hidden />
      </button>
    </div>
  );
}
