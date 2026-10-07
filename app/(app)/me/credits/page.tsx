import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getBalance, listTransactions } from "@/lib/credits/ledger";
import { isOnWaitlist } from "@/lib/credits/waitlist";
import { PLANS } from "@/lib/credits/plans";
import { Button } from "@/components/ui/button";
import { joinWaitlistAction } from "./actions";

const TXN_LABEL: Record<string, string> = {
  grant: "Monthly allowance",
  debit: "AI scan",
  refund: "Refund",
  expire: "Expired",
  purchase: "Credit purchase",
};

function formatAmount(amount: number): string {
  return amount > 0 ? `+${amount}` : `${amount}`;
}

export default async function CreditsPage() {
  const { userId, profile } = await requireUser();
  const [balance, txns, onWaitlist] = await Promise.all([
    getBalance(userId),
    listTransactions(userId),
    isOnWaitlist(userId),
  ]);

  const pct = balance.allowance > 0 ? Math.min(balance.credits / balance.allowance, 1) * 100 : 0;
  const resetsOn = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", timeZone: profile.timezone }).format(balance.periodResetsAt);
  const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: profile.timezone });

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <Link href="/me" aria-label="Back to Me" className="-ml-2 grid size-11 place-items-center rounded-md text-subtle hover:bg-sunken">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="title text-[30px]">Credits</h1>
      </header>

      <section className="rounded-[18px] border border-line bg-surface p-5 shadow-card">
        <div className="text-sm text-subtle">AI scans left this month</div>
        <div className="num text-[40px] font-bold leading-[1.1]">
          {balance.credits}
          <span className="text-lg font-normal text-subtle"> / {balance.allowance}</span>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-sunken">
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2.5 text-sm text-subtle">
          Resets on {resetsOn}. Barcode scans, search and logging are always free. Failed scans are refunded.
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <section className="flex flex-col rounded-[18px] border border-line bg-surface p-4 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <b className="title text-lg">Basic</b>
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-ink">Current</span>
          </div>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm text-subtle">
            <li>{PLANS.basic.aiScansPerMonth} AI scans a month</li>
            <li>Unlimited barcode scans and logging</li>
          </ul>
        </section>
        <section className="flex flex-col rounded-[18px] border border-line bg-surface p-4 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <b className="title text-lg">Pro</b>
            <span className="rounded-full bg-sunken px-2.5 py-1 text-xs font-semibold text-subtle">Coming soon</span>
          </div>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm text-subtle">
            <li>{PLANS.pro.aiScansPerMonth} AI scans a month</li>
            <li>Unlimited barcode scans and logging</li>
          </ul>
          {onWaitlist ? (
            <Button type="button" disabled className="mt-3 h-11 w-full">
              You&apos;re on the list
            </Button>
          ) : (
            <form action={joinWaitlistAction} className="mt-3">
              <Button type="submit" className="h-11 w-full">
                Join the waitlist
              </Button>
            </form>
          )}
        </section>
      </div>

      <section className="rounded-[18px] border border-line bg-surface shadow-card">
        <h2 className="title px-4 pt-4 text-lg">Activity</h2>
        <div className="flex flex-col">
          {txns.length === 0 && <div className="px-4 py-4 text-sm text-subtle">No activity yet.</div>}
          {txns.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
              <div>
                <div className="font-medium">{TXN_LABEL[t.type] ?? t.type}</div>
                <div className="text-sm text-subtle">{dateFmt.format(t.createdAt)}</div>
              </div>
              <div className="num font-semibold">{formatAmount(t.amount)}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
