import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function DateSwitcher({ date, prev, next, today }: { date: string; prev: string; next: string | null; today: string }) {
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
