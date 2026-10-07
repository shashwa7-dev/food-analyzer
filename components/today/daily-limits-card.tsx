import { useId } from "react";
import { AlertTriangle, Candy, Droplet, Droplets, Shield, type LucideIcon } from "lucide-react";
import { RailCard, RailCardHead } from "@/components/today/rail-card";
import { limitAmount, limitRows, limitsSummary, unknownNote, type LimitKey, type LimitTone } from "@/lib/today/tone";
import type { TargetProgress } from "@/lib/nutrition/totals";
import { cn } from "@/lib/utils";

const ICON: Record<LimitKey, LucideIcon> = { sodiumMgMax: Droplets, satFatMax: Droplet, sugarsMax: Candy };
// Words in --warn-ink (--warn is too light for text on white); the icon and bar use --warn.
// "partial" (some items unknown) never takes ok's brand-deep bar: it is muted, not a confident "fine".
const TONE_TEXT: Record<LimitTone, string> = { ok: "text-subtle", near: "text-warn-ink", over: "text-bad", partial: "text-subtle" };
const TONE_ICON: Record<LimitTone, string> = { ok: "text-subtle", near: "text-warn", over: "text-bad", partial: "text-subtle" };
const TONE_BAR: Record<LimitTone, string> = { ok: "bg-brand-deep", near: "bg-warn", over: "bg-bad", partial: "bg-subtle/50" };
const TONE_SR: Record<LimitTone, string> = { ok: "", near: ", close to the limit", over: ", over the limit", partial: "" };

/** True when the phone should show the card: any limit at 90% or more. */
export function hasLimitAlert(progress: TargetProgress[]): boolean {
  return limitsSummary(limitRows(progress)).badge !== null;
}

/**
 * The Daily limits card (mock-c1 "Today on desktop", option A): sodium, saturated fat and sugar, each
 * "{eaten} / {limit}" over a 6 px bar (brand-deep, warn from 90%, bad over 100%; the bar stops at
 * full). A badge counts the close or over limits (over wins) and one line names the worst; with all
 * three under 90% there is neither. A limit some items have no value for reads "300+ / 2,000 mg" with
 * a muted "1 item unknown" under its bar, and is never shown in the ok colours.
 */
export function DailyLimitsCard({ progress, className }: { progress: TargetProgress[]; className?: string }) {
  const titleId = useId();
  const rows = limitRows(progress);
  const { badge, tip } = limitsSummary(rows);
  return (
    <RailCard labelledBy={titleId} className={className}>
      <RailCardHead id={titleId} icon={Shield} title="Daily limits">
        {badge && (
          <span
            className={cn(
              "inline-flex items-center gap-[5px] rounded-full px-[9px] py-1 text-xs font-[650] whitespace-nowrap",
              badge.tone === "over" ? "bg-bad/10 text-bad" : "bg-warn/10 text-warn-ink",
            )}
          >
            <AlertTriangle className="size-[13px] shrink-0" aria-hidden />
            {badge.text}
            <span className="sr-only">{badge.tone === "over" ? " the limit" : " to the limit"}</span>
          </span>
        )}
      </RailCardHead>
      <ul className="m-0 grid list-none gap-2.5 p-0">
        {rows.map(({ key, label, total, target, unit, ratio, tone, unknown }) => {
          const Icon = ICON[key];
          const amount = `${limitAmount(total, target, unknown > 0)} ${unit}`;
          const note = unknown > 0 ? unknownNote(unknown) : null;
          return (
            <li key={key} className="grid gap-1.5">
              <span className="sr-only">{`${label}: ${amount.replace("+ / ", " or more of ").replace(" / ", " of ")}${TONE_SR[tone]}${note ? `, ${note}` : ""}`}</span>
              <div aria-hidden className="flex items-center justify-between gap-2 text-[13.5px]">
                <span className="inline-flex min-w-0 items-center gap-[7px] font-semibold whitespace-nowrap text-ink">
                  <Icon className={cn("size-4 shrink-0", TONE_ICON[tone])} />
                  {label}
                </span>
                <span className={cn("num whitespace-nowrap", TONE_TEXT[tone], (tone === "near" || tone === "over") && "font-[650]")}>{amount}</span>
              </div>
              <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-sunken">
                <div className={cn("h-full rounded-full", TONE_BAR[tone])} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
              </div>
              {note && <span aria-hidden className="text-right text-xs whitespace-nowrap text-subtle">{note}</span>}
            </li>
          );
        })}
      </ul>
      {tip && <p className="m-0 text-[12.5px] text-subtle">{tip}</p>}
    </RailCard>
  );
}
