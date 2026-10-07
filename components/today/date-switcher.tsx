"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { formatLocalDate, parseLocalDate } from "@/lib/dates";

export function DateSwitcher({ date, prev, next, today }: { date: string; prev: string; next: string | null; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 900px)");

  const todayDate = parseLocalDate(today);
  const minDate = parseLocalDate(today);
  minDate.setDate(minDate.getDate() - 365);

  function pick(picked: Date | undefined) {
    if (!picked) return;
    setOpen(false);
    router.push(`/today?date=${formatLocalDate(picked)}`);
  }

  const calendar = (
    <Calendar
      mode="single"
      selected={parseLocalDate(date)}
      defaultMonth={parseLocalDate(date)}
      onSelect={pick}
      disabled={[{ before: minDate }, { after: todayDate }]}
      today={todayDate}
    />
  );

  return (
    <div className="flex items-center gap-1.5">
      <Link href={`/today?date=${prev}`} aria-label="Previous day" className="grid size-11 place-items-center rounded-md text-subtle hover:bg-sunken">
        <ChevronLeft className="size-5" aria-hidden />
      </Link>
      {date !== today && (
        <Link href="/today" className="flex min-h-11 items-center rounded-full bg-accent-soft px-3 text-sm font-semibold">
          Today
        </Link>
      )}
      {isDesktop ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger aria-label="Pick a date" className="grid size-11 place-items-center rounded-md text-subtle hover:bg-sunken">
            <CalendarIcon className="size-5" aria-hidden />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">{calendar}</PopoverContent>
        </Popover>
      ) : (
        <Drawer open={open} onOpenChange={setOpen}>
          <button
            type="button"
            aria-label="Pick a date"
            onClick={() => setOpen(true)}
            className="grid size-11 place-items-center rounded-md text-subtle hover:bg-sunken"
          >
            <CalendarIcon className="size-5" aria-hidden />
          </button>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle className="section-title text-left">Pick a date</DrawerTitle>
            </DrawerHeader>
            <div className="flex justify-center pb-[calc(16px+env(safe-area-inset-bottom))]">{calendar}</div>
          </DrawerContent>
        </Drawer>
      )}
      {next ? (
        <Link href={`/today?date=${next}`} aria-label="Next day" className="grid size-11 place-items-center rounded-md text-subtle hover:bg-sunken">
          <ChevronRight className="size-5" aria-hidden />
        </Link>
      ) : (
        <span aria-hidden className="size-11" />
      )}
    </div>
  );
}
