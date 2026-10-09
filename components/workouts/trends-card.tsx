"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { MonthCalendar as MonthCalendarData, VolumeWeeks } from "@/lib/fitness/insights";
import { ProBadge } from "@/components/pro/pro-chip";
import { MonthCalendar } from "@/components/workouts/month-calendar";
import { VolumeChart } from "@/components/workouts/volume-chart";
import { cn } from "@/lib/utils";

const CARD = "rounded-[24px] bg-surface shadow-card";
const STORAGE_KEY = "eatri8-trends-tab";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const TABS = [
  { id: "calendar", label: "Calendar" },
  { id: "volume", label: "Volume" },
] as const;
type Tab = (typeof TABS)[number]["id"];

function monthName(month: string): string {
  return MONTHS[Number(month.slice(5, 7)) - 1] ?? month;
}

/**
 * The Pro trends card (chart-stack-or-switch-v2.html, option B): one card, a Calendar | Volume switch
 * in its header. The calendar always shows the current month and the volume chart always shows the
 * last 8 weeks, whatever Week/Month says (only Top exercises and How often follow the range). The
 * active tab is remembered in localStorage, read in an effect so there's no hydration mismatch.
 */
export function TrendsCard({ calendar, volume, className }: { calendar: MonthCalendarData; volume: VolumeWeeks; className?: string }) {
  const [tab, setTab] = useState<Tab>("calendar");
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads localStorage once after mount, never during render (no hydration mismatch)
      if (saved === "calendar" || saved === "volume") setTab(saved);
    } catch {
      // Private browsing or storage disabled: just keep the default.
    }
  }, []);

  const pick = (t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // Ignore: nothing to persist, the tab still switches for this visit.
    }
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = TABS.length - 1;
    const to = e.key === "ArrowRight" ? (i === last ? 0 : i + 1) : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1) : null;
    if (to === null) return;
    e.preventDefault();
    pick(TABS[to]!.id);
    refs.current[to]?.focus();
  };

  const title = tab === "calendar" ? monthName(calendar.month) : "Last 8 weeks";

  return (
    <section aria-labelledby={`${base}-title`} className={cn(CARD, "grid grid-cols-[minmax(0,1fr)] min-w-0 gap-2.5 p-3.5 md:p-4", className)}>
      <div className="flex min-h-7 min-w-0 items-center justify-between gap-2">
        <h2 id={`${base}-title`} className="m-0 inline-flex items-center gap-1.5 text-[15px] font-semibold whitespace-nowrap text-ink">
          {title}
          <ProBadge size="sm" />
        </h2>
        <div role="tablist" aria-label="Trends view" className="inline-flex shrink-0 rounded-full bg-sunken p-1">
          {TABS.map((t, i) => {
            const on = t.id === tab;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`${base}-${t.id}-tab`}
                aria-selected={on}
                aria-controls={`${base}-panel`}
                tabIndex={on ? 0 : -1}
                onClick={() => pick(t.id)}
                onKeyDown={(e) => onKey(e, i)}
                className={cn(
                  "relative h-7 shrink-0 rounded-full px-3.5 text-[12.5px] font-semibold whitespace-nowrap transition-colors after:absolute after:inset-x-0 after:-inset-y-2 after:content-['']",
                  on ? "bg-action text-action-ink" : "text-subtle hover:text-ink",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-${tab}-tab`} className="min-w-0">
        {tab === "calendar" ? <MonthCalendar calendar={calendar} /> : <VolumeChart volume={volume} />}
      </div>
    </section>
  );
}
