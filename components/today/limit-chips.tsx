import { useId } from "react";
import { AlertCircle, AlertTriangle, Candy, Droplet, Droplets, type LucideIcon } from "lucide-react";
import { limitChips, limitsHeading, type LimitKey } from "@/lib/today/tone";
import type { TargetProgress } from "@/lib/nutrition/totals";
import { cn } from "@/lib/utils";

const ICON: Record<LimitKey, LucideIcon> = { sugarsMax: Candy, sodiumMgMax: Droplets, satFatMax: Droplet };
const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");

/**
 * Sugar, sodium and saturated fat, only when at 90%+ of the limit (warn) or over it (bad), worst first,
 * under a one-line heading: "Over your daily limit" if any is over, else "Close to your daily limit".
 */
export function LimitChips({ progress }: { progress: TargetProgress[] }) {
  const headingId = useId();
  const chips = limitChips(progress);
  const heading = limitsHeading(chips);
  if (!heading) return null;
  const HeadingIcon = heading.tone === "over" ? AlertTriangle : AlertCircle;
  return (
    <section aria-labelledby={headingId} className="grid gap-2">
      <p
        id={headingId}
        className={cn("m-0 flex items-center gap-1.5 text-[13px] font-semibold whitespace-nowrap", heading.tone === "over" ? "text-bad" : "text-warn")}
      >
        <HeadingIcon className="size-[15px] shrink-0" aria-hidden />
        {heading.text}
      </p>
      <ul aria-label="Daily limits" className="m-0 flex list-none flex-wrap gap-2 p-0">
        {chips.map(({ key, label, total, target, unit, tone }) => {
          const Icon = ICON[key];
          return (
            <li
              key={key}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-semibold",
                tone === "over" ? "bg-bad/12 text-bad" : "bg-warn/12 text-warn",
              )}
            >
              <Icon className="size-[15px] shrink-0" aria-hidden />
              <span className="num">{label} {fmt(total)} / {fmt(target)} {unit}</span>
              <span className="sr-only">{tone === "over" ? ", over the limit" : ", near the limit"}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
