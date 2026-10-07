"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Check } from "lucide-react";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { api } from "@/lib/api-client";
import { addDays, formatLocalDate, isAllowedLogDate, parseLocalDate } from "@/lib/dates";
import { dayLabels } from "@/lib/today/headline";

const monthKey = (d: Date) => formatLocalDate(d).slice(0, 7);
const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];

function useLoggedDates(month: string) {
  return useQuery({
    queryKey: ["log", "dates", month],
    queryFn: () => api<{ dates: string[] }>(`/api/v1/log/dates?month=${month}`),
    staleTime: 60_000,
  });
}

/**
 * Month grid (Monday first) with a dot on each day that has food logged, then "Today" and
 * "Go to {d Mon}" (spec §6.5). Days after `today` (the profile's local date) or outside the
 * allowed log window can't be picked — the same rule the log API enforces.
 */
function DatePickerBody({ date, today, onDone }: { date: string; today: string; onDone: () => void }) {
  const router = useRouter();
  const [picked, setPicked] = useState(date);
  const [month, setMonth] = useState(() => parseLocalDate(date));
  const logged = useLoggedDates(monthKey(month));
  const loggedSet = new Set(logged.data?.dates ?? []);
  const oldest = addDays(today, -365);

  const go = (to: string) => {
    onDone();
    router.push(to === today ? "/today" : `/today?date=${to}`);
  };

  return (
    <div className="flex flex-col gap-3.5">
      <Calendar
        mode="single"
        required
        weekStartsOn={1}
        month={month}
        onMonthChange={setMonth}
        startMonth={parseLocalDate(oldest)}
        endMonth={parseLocalDate(today)}
        selected={parseLocalDate(picked)}
        onSelect={(d) => setPicked(formatLocalDate(d))}
        today={parseLocalDate(today)}
        disabled={(d) => {
          const s = formatLocalDate(d);
          return s > today || s < oldest || !isAllowedLogDate(s);
        }}
        modifiers={{ logged: (d) => loggedSet.has(formatLocalDate(d)) }}
        formatters={{ formatWeekdayName: (d) => WEEKDAY[d.getDay()]! }}
        labels={{ labelWeekday: (d) => d.toLocaleDateString("en-GB", { weekday: "long" }) }}
        components={{
          DayButton: ({ children, modifiers, ...props }) => (
            <CalendarDayButton modifiers={modifiers} {...props}>
              <span className="num">{children}</span>
              {modifiers.logged && (
                <i
                  aria-hidden
                  className="absolute bottom-[5px] left-1/2 size-[5px] -translate-x-1/2 rounded-full bg-brand-deep group-data-[selected-single=true]/button:bg-brand dark:group-data-[selected-single=true]/button:bg-brand-ink"
                />
              )}
              {modifiers.logged && <span className="sr-only">, food logged</span>}
            </CalendarDayButton>
          ),
        }}
      />
      <p className="m-0 flex items-center gap-2 text-[12.5px] text-subtle">
        <i aria-hidden className="size-1.5 rounded-full bg-brand-deep" />
        Days with food logged
      </p>
      <div className="grid grid-cols-[1fr_1.3fr] gap-2.5">
        <Button type="button" variant="ghost-sunken" shape="pill" size="xl" className="h-[54px] min-w-0 px-4" onClick={() => go(today)}>
          <CalendarDays aria-hidden />
          Today
        </Button>
        <Button type="button" shape="pill" size="xl" className="h-[54px] min-w-0 px-4" onClick={() => go(picked)}>
          <Check aria-hidden />
          Go to {dayLabels(picked).short}
        </Button>
      </div>
    </div>
  );
}

export function DatePickerSheet({ open, onOpenChange, date, today }: { open: boolean; onOpenChange: (open: boolean) => void; date: string; today: string }) {
  const isDesktop = useMediaQuery("(min-width: 900px)");
  const close = () => onOpenChange(false);
  // A fresh body per opening, so each one starts from the page's date and its month; it stays
  // mounted while closing so the sheet doesn't empty mid-animation.
  const [session, setSession] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSession((n) => n + 1);
  }
  const body = <DatePickerBody key={session} date={date} today={today} onDone={close} />;

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={false} className="gap-3.5 p-[22px] sm:max-w-[400px]">
          <DialogTitle className="sr-only">Pick a date</DialogTitle>
          {body}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      <DrawerContent className="shadow-[0_-10px_30px_rgb(0_0_0/.18)]">
        <DrawerTitle className="sr-only">Pick a date</DrawerTitle>
        <div className="px-[18px] pt-2.5 pb-[calc(22px+env(safe-area-inset-bottom))]">{body}</div>
      </DrawerContent>
    </Drawer>
  );
}
