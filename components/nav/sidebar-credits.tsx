import Link from "next/link";
import { Barcode, ScanText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { cn } from "@/lib/utils";
import { creditsState } from "@/lib/credits/display";

/** The desktop sidebar's credits card (spec §5, mock `.credit` / `.side.low .credit`). */
export function SidebarCredits({ credits, allowance, resetsLabel }: { credits: number; allowance: number; resetsLabel: string }) {
  const low = creditsState(credits) !== "ok";
  const filled = Math.max(0, Math.min(credits, allowance));
  const fillClass = low ? "bg-warn" : "bg-brand";

  return (
    <section
      aria-label="AI scan credits"
      className={cn("mt-auto grid gap-3 rounded-[20px] bg-surface p-3.5 text-[13px] shadow-card", low && "bg-warn/10 ring-1 ring-warn/35")}
    >
      <div className="flex items-center gap-2.5">
        <IconTile tone="brand" size="sm" className={low ? "bg-warn/15 text-warn" : undefined}>
          <Sparkles aria-hidden />
        </IconTile>
        <div className="min-w-0">
          <p className="num truncate text-base font-semibold text-ink">
            {credits} scan{credits === 1 ? "" : "s"} left
          </p>
          <p className="num truncate text-subtle">
            {low ? `Resets ${resetsLabel} · barcodes still free` : `of ${allowance} · resets ${resetsLabel}`}
          </p>
        </div>
      </div>
      {allowance > 30 ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
          <div className={cn("h-full rounded-full", fillClass)} style={{ width: `${(filled / allowance) * 100}%` }} />
        </div>
      ) : (
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${allowance}, minmax(0, 1fr))` }} aria-hidden="true">
          {Array.from({ length: allowance }, (_, i) => (
            <div key={i} className={cn("h-3.5 rounded-[4px]", i < filled ? fillClass : "bg-sunken")} />
          ))}
        </div>
      )}
      <ul className="grid gap-1.5 text-subtle">
        <li className="flex items-center gap-2 whitespace-nowrap">
          <Barcode className="size-[15px] shrink-0" aria-hidden />
          Barcodes are free
        </li>
        <li className="flex items-center gap-2 whitespace-nowrap">
          <ScanText className="size-[15px] shrink-0" aria-hidden />
          Label or meal photo uses 1
        </li>
      </ul>
      <Button
        render={<Link href="/me/credits#pro" />}
        nativeButton={false}
        shape="pill"
        size="lg"
        variant={low ? "default" : "outline"}
        className="w-full gap-1.5 text-[13px]"
      >
        <Sparkles className="size-4" aria-hidden />
        {low ? "Get more with Pro" : "Join Pro waitlist"}
      </Button>
    </section>
  );
}
