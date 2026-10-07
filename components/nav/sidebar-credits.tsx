import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { creditsState } from "@/lib/credits/display";

/** The desktop sidebar's credits row: just the limit, one line, linking to the credits page. Amber when low. */
export function SidebarCredits({ credits, allowance, resetsLabel }: { credits: number; allowance: number; resetsLabel: string }) {
  const low = creditsState(credits) !== "ok";
  return (
    <Link
      href="/me/credits"
      aria-label={`${credits} of ${allowance} AI scans left, resets ${resetsLabel}`}
      title={`Resets ${resetsLabel}`}
      className={cn(
        "mt-auto flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-full px-3.5 py-2.5 text-[13px] font-semibold transition-colors",
        low ? "bg-warn/12 text-ink ring-1 ring-warn/35 hover:bg-warn/18" : "bg-brand-soft text-ink hover:bg-brand-soft/80",
      )}
    >
      <Sparkles className={cn("size-4 shrink-0", low ? "text-warn" : "text-brand-deep")} aria-hidden />
      <span className="num min-w-0 truncate">
        {credits} / {allowance} scans left
      </span>
      <ChevronRight className="ml-auto size-4 shrink-0 opacity-60" aria-hidden />
    </Link>
  );
}
