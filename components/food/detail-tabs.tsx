"use client";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Pill tabs over server-rendered panels (a food page's "Why D" and "Ingredients"), with the WAI-ARIA
 * tabs pattern: one tab stop, arrow keys / Home / End move and select. Every panel stays in the DOM
 * (hidden ones with `hidden`), so nothing is fetched or re-rendered on a switch.
 */
export function DetailTabs({ tabs, label }: { tabs: { id: string; label: string; panel: ReactNode }[]; label: string }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  if (tabs.length === 0) return null;

  const onKey = (e: KeyboardEvent, i: number) => {
    const last = tabs.length - 1;
    const to = e.key === "ArrowRight" ? (i === last ? 0 : i + 1) : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (to === null) return;
    e.preventDefault();
    setActive(tabs[to]!.id);
    refs.current[to]?.focus();
  };

  return (
    <section className="grid gap-3">
      <div role="tablist" aria-label={label} className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {tabs.map((t, i) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="tab"
              id={`${base}-${t.id}-tab`}
              aria-selected={on}
              aria-controls={`${base}-${t.id}-panel`}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(t.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                "min-h-11 shrink-0 rounded-full border px-4 text-[13.5px] font-semibold whitespace-nowrap transition-colors",
                on ? "border-transparent bg-action text-action-ink" : "border-line bg-surface text-subtle hover:text-ink",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`${base}-${t.id}-panel`}
          aria-labelledby={`${base}-${t.id}-tab`}
          hidden={t.id !== active}
          tabIndex={0}
          className="rounded-[20px] bg-surface p-[18px] shadow-card outline-none focus-visible:ring-2 focus-visible:ring-brand-deep"
        >
          {t.panel}
        </div>
      ))}
    </section>
  );
}
