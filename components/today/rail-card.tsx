import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** The shell of a Today insights card (mock-c1 `.t2-card`): a white card with a 10 px rhythm. */
export function RailCard({ labelledBy, className, children }: { labelledBy: string; className?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={labelledBy} className={cn("grid min-w-0 gap-2.5 rounded-[24px] bg-surface px-4 py-3.5 shadow-card md:gap-3.5 md:px-5 md:py-[18px]", className)}>
      {children}
    </section>
  );
}

/** A card's header row (mock-c1 `.cc-head`): icon and title on the left, a badge or a link on the right. */
export function RailCardHead({ id, icon: Icon, title, children }: { id: string; icon: LucideIcon; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-7 items-center justify-between gap-2">
      <h2 id={id} className="m-0 inline-flex min-w-0 items-center gap-[7px] text-[15px] font-semibold whitespace-nowrap text-ink">
        <Icon className="size-[18px] shrink-0 text-brand-deep" aria-hidden />
        {title}
      </h2>
      {children}
    </div>
  );
}

/** "Progress ›": a 44 px tall link that only takes the header's 28 px (negative margins). */
export function RailCardLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="-my-2 -mr-2 inline-flex min-h-11 shrink-0 items-center gap-[3px] rounded-full px-2 text-[13px] font-semibold whitespace-nowrap text-brand-deep hover:underline hover:underline-offset-4"
    >
      {children}
      <ChevronRight className="size-[15px]" aria-hidden />
    </Link>
  );
}
