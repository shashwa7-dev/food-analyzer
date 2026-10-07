"use client";
import { useState } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { DatePickerSheet } from "@/components/today/date-picker-sheet";

/**
 * The Today header's date controls: a "Today" pill while looking at another day, and the round
 * calendar button that opens the date picker sheet.
 */
export function DateSwitcher({ date, today }: { date: string; today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex shrink-0 items-center gap-2">
      {date !== today && (
        <Link
          href="/today"
          className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-surface px-4 text-sm font-semibold text-ink shadow-card hover:bg-sunken"
        >
          Today
        </Link>
      )}
      <button
        type="button"
        aria-label="Pick a date"
        onClick={() => setOpen(true)}
        className="grid size-11 place-items-center rounded-full border border-line bg-surface text-ink hover:bg-sunken"
      >
        <CalendarDays className="size-5" aria-hidden />
      </button>
      <DatePickerSheet open={open} onOpenChange={setOpen} date={date} today={today} />
    </div>
  );
}
