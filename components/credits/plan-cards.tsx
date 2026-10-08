"use client";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Barcode, CalendarRange, Check, Download, RotateCcw, Sparkles, Target, TrendingUp, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PLANS } from "@/lib/credits/plan-features";
import { usePro } from "@/components/pro/pro-context";

function Perk({ icon: Icon, tone, children }: { icon: LucideIcon; tone: "muted" | "brand"; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Icon className={cn("mt-px size-[18px] shrink-0", tone === "brand" ? "text-brand-deep" : "text-subtle")} aria-hidden />
      <span>{children}</span>
    </li>
  );
}

function Badge({ tone, children }: { tone: "brand" | "plain"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-[5px] rounded-full px-2.5 py-1.5 text-[12.5px] leading-none font-[650] whitespace-nowrap",
        tone === "brand" ? "bg-brand-soft text-on-brand-soft" : "bg-surface text-subtle ring-1 ring-line",
      )}
    >
      {children}
    </span>
  );
}

function JoinButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" shape="pill" size="lg" className="w-full" disabled={pending}>
      <Sparkles aria-hidden />
      {pending ? "Joining…" : "Join the waitlist"}
    </Button>
  );
}

/**
 * Basic and Pro (spec §6.14, §B): Basic plain, Pro highlighted with a lime border and a soft wash, and
 * Join the waitlist (the existing server action, through the Pro context so every copy agrees). On
 * /me/credits (#pro) side by side from 640 px, stacked with Pro second on phones; `stacked` in the
 * upgrade sheet, which is too narrow for two columns.
 */
export function PlanCards({ stacked = false }: { stacked?: boolean }) {
  const { plan, onWaitlist, joinWaitlist } = usePro();
  const body = (
    <div className={cn("grid gap-2.5", !stacked && "sm:grid-cols-2")}>
      <div className="flex flex-col gap-3.5 rounded-[24px] bg-surface p-4 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <h3 className="m-0 text-[17px] font-semibold text-ink">Basic</h3>
          {plan === "basic" && <Badge tone="brand"><Check className="size-3.5" aria-hidden />Current plan</Badge>}
        </div>
        <ul className="m-0 grid list-none gap-2 p-0 text-[13.5px] leading-snug text-ink">
          <Perk icon={Sparkles} tone="muted">{PLANS.basic.aiScansPerMonth} AI scans a month</Perk>
          <Perk icon={Barcode} tone="muted">Barcode scans, search and logging free</Perk>
          <Perk icon={RotateCcw} tone="muted">Failed scans refunded</Perk>
        </ul>
      </div>

      <div className="flex flex-col gap-3.5 rounded-[24px] border-2 border-brand bg-brand-soft/45 p-4 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <h3 className="m-0 inline-flex items-center gap-1.5 text-[17px] font-semibold text-ink">
            <Sparkles className="size-[18px] text-brand-deep" aria-hidden />
            Pro
          </h3>
          {plan === "pro" ? <Badge tone="brand"><Check className="size-3.5" aria-hidden />Current plan</Badge> : <Badge tone="plain">Coming soon</Badge>}
        </div>
        <div className="grid gap-2">
          <p className="m-0 text-[13px] font-semibold text-subtle">Everything in Basic, plus:</p>
          <ul className="m-0 grid list-none gap-2 p-0 text-[13.5px] leading-snug text-ink">
            <Perk icon={Sparkles} tone="brand">{PLANS.pro.aiScansPerMonth} AI scans a month</Perk>
            <Perk icon={CalendarRange} tone="brand">Month view on Progress</Perk>
            <Perk icon={Download} tone="brand">Export your data (CSV)</Perk>
            <Perk icon={Target} tone="brand">Custom daily targets</Perk>
            <Perk icon={TrendingUp} tone="brand">Workout insights</Perk>
          </ul>
        </div>
        {plan !== "pro" && (onWaitlist ? (
          <Button type="button" disabled variant="ghost-sunken" shape="pill" size="lg" className="mt-auto w-full bg-surface">
            <Check aria-hidden />
            You&apos;re on the list
          </Button>
        ) : (
          <form action={joinWaitlist} className="mt-auto">
            <JoinButton />
          </form>
        ))}
      </div>
    </div>
  );
  if (stacked) return body;
  return (
    <section id="pro" aria-labelledby="plans-title" className="grid scroll-mt-6 gap-2.5">
      <h2 id="plans-title" className="sr-only">Plans</h2>
      {body}
    </section>
  );
}
