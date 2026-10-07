import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A Progress card (mock `.chart-card`): icon + title on the left, a legend or unit note on the right. */
export function ChartCard({ icon: Icon, title, aside, className, children }: {
  icon: LucideIcon; title: string; aside?: ReactNode; className?: string; children: ReactNode;
}) {
  return (
    <section aria-label={title} className={cn("grid min-w-0 content-start gap-2.5 rounded-[24px] bg-surface p-3.5 shadow-card md:gap-3.5 md:p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="m-0 inline-flex items-center gap-[7px] whitespace-nowrap text-[15px] font-bold text-ink">
          <Icon className="size-[18px] shrink-0 text-brand-deep" aria-hidden />
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** The muted unit note on the right of a card header ("mg per day"). */
export function CardNote({ children }: { children: ReactNode }) {
  return <span className="whitespace-nowrap text-[12.5px] text-subtle">{children}</span>;
}

/** The one-line takeaway under a chart (mock `.cc-note`). */
export function Takeaway({ icon: Icon, tone, children }: { icon: LucideIcon; tone: "warn" | "good"; children: ReactNode }) {
  return (
    <p className="m-0 flex items-center gap-2 text-[13px] text-ink">
      <Icon className={cn("size-4 shrink-0", tone === "warn" ? "text-warn" : "text-brand-deep")} aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** A colour key + label + value row for donut legends (mock `.leg-list`). */
export function LegendList({ items, className }: { items: { key: string; label: string; value: string; swatch: string }[]; className?: string }) {
  return (
    <ul className={cn("num m-0 grid flex-1 list-none gap-2 p-0 text-[13.5px] text-ink", className)}>
      {items.map((it) => (
        <li key={it.key} className="flex items-center gap-2">
          <i className="size-2.5 shrink-0 rounded-[3px]" style={{ background: it.swatch }} aria-hidden />
          <span className="whitespace-nowrap">{it.label}</span>
          <b className="ml-auto font-semibold">{it.value}</b>
        </li>
      ))}
    </ul>
  );
}

/**
 * A reference-line key for a card header: a short dashed swatch in the line's colour and its label
 * ("Target 1,700"). The label lives here rather than on the plot, so it never collides with the data.
 */
export function RefKey({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-[5px] whitespace-nowrap">
      <svg aria-hidden width="14" height="10" viewBox="0 0 14 10" className="shrink-0">
        <line x1="0" x2="14" y1="5" y2="5" stroke={color} strokeWidth="1.5" strokeDasharray="4 2.5" />
      </svg>
      {children}
    </span>
  );
}
