import { Check, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/session";
import { countActivity, getBalance, listActivity, periodBalances } from "@/lib/credits/ledger";
import { currentPeriod } from "@/lib/credits/logic";
import { balanceSeries } from "@/lib/credits/activity";
import { sweepStuck } from "@/lib/scans/service";
import { isOnWaitlist } from "@/lib/credits/waitlist";
import { PLANS } from "@/lib/credits/plans";
import { addDays, todayIn } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/nav/back-button";
import { BalanceChart } from "@/components/credits/balance-chart";
import { ActivityList } from "@/components/credits/activity-list";
import { joinWaitlistAction } from "./actions";

const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="grid min-w-0 justify-items-center rounded-2xl bg-surface px-1 py-2.5 text-center shadow-card">
      <b className="num text-[20px] leading-tight font-bold tracking-[-0.03em] text-ink">{value}</b>
      <span className="truncate text-[12px] whitespace-nowrap text-subtle">{label}</span>
    </div>
  );
}

function Perk({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 size-4 shrink-0 text-brand-deep" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

/**
 * Scan credits (spec §6.14, mock "Credits & activity"): the balance this period as a step chart,
 * used / free / refunded counts, the activity grouped by day, then the plans (#pro).
 */
export default async function CreditsPage() {
  const { userId, profile } = await requireUser();
  await sweepStuck(userId); // a killed scan job's credit is refunded before the balance is shown
  const now = new Date();
  const [balance, txns, counts, firstPage, onWaitlist] = await Promise.all([
    getBalance(userId, now),
    periodBalances(userId, now),
    countActivity(userId, now),
    listActivity(userId, "all"),
    isOnWaitlist(userId),
  ]);

  // The allowance period is a UTC month; the chart's days are the user's local days within it.
  const period = currentPeriod(now);
  const periodStart = `${period}-01`;
  const periodEnd = addDays(balance.periodResetsAt.toISOString().slice(0, 10), -1);
  const localToday = todayIn(profile.timezone, now);
  const today = localToday < periodStart ? periodStart : localToday > periodEnd ? periodEnd : localToday;
  const grant = txns.find((t) => t.type === "grant");
  const changes = txns.filter((t) => t.type !== "grant" && t.type !== "expire");
  const series = balanceSeries(changes, periodStart, today, profile.timezone, grant?.balanceAfter ?? balance.allowance);
  // Today ends at the live balance: rows written in one transaction share a timestamp, so the
  // ledger alone can't always say which came last.
  const last = series.at(-1);
  if (last && today === localToday) last.balance = balance.credits;
  const points: { date: string; balance: number | null; event: boolean }[] = [];
  for (let d = periodStart; d <= periodEnd; d = addDays(d, 1)) {
    const p = series.find((s) => s.date === d);
    points.push({ date: d, balance: p?.balance ?? null, event: p?.event ?? false });
  }
  const month = MONTH_LONG[Number(period.slice(5)) - 1]!;

  return (
    <div className="mx-auto grid w-full max-w-[560px] gap-3">
      <div className="flex items-center justify-between gap-2.5">
        <BackButton fallback="/me" />
        <h1 className="m-0 min-w-0 truncate text-center text-[17px] font-semibold whitespace-nowrap text-ink">Scan credits</h1>
        <span className="size-11 shrink-0" aria-hidden />
      </div>

      <BalanceChart credits={balance.credits} allowance={balance.allowance} month={month} points={points} today={today} end={periodEnd} />

      <div className="grid grid-cols-3 gap-2">
        <Stat value={counts.used} label="used" />
        <Stat value={counts.free} label="free barcodes" />
        <Stat value={counts.refunded} label="refunded" />
      </div>

      <ActivityList initialPage={firstPage} tz={profile.timezone} now={now.toISOString()} />

      <section id="pro" aria-label="Plans" className="mt-3 grid scroll-mt-6 gap-2.5">
        <h2 className="m-0 px-1 text-[17px] font-semibold tracking-[-0.018em] text-ink">Plans</h2>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-[24px] bg-surface p-4 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <b className="text-[17px] font-semibold text-ink">Basic</b>
              <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-brand-deep">Current</span>
            </div>
            <ul className="m-0 grid list-none gap-1.5 p-0 text-[13.5px] text-subtle">
              <Perk>{PLANS.basic.aiScansPerMonth} AI scans a month</Perk>
              <Perk>Barcode scans, search and logging always free</Perk>
              <Perk>Failed scans refunded</Perk>
            </ul>
          </div>
          <div className="flex flex-col gap-3 rounded-[24px] bg-surface p-4 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <b className="text-[17px] font-semibold text-ink">Pro</b>
              <span className="rounded-full bg-sunken px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-subtle">Coming soon</span>
            </div>
            <ul className="m-0 grid list-none gap-1.5 p-0 text-[13.5px] text-subtle">
              <Perk>{PLANS.pro.aiScansPerMonth} AI scans a month</Perk>
              <Perk>Barcode scans, search and logging always free</Perk>
            </ul>
            {onWaitlist ? (
              <Button type="button" disabled variant="ghost-sunken" shape="pill" size="lg" className="mt-auto w-full">
                <Check aria-hidden />
                You&apos;re on the list
              </Button>
            ) : (
              <form action={joinWaitlistAction} className="mt-auto">
                <Button type="submit" shape="pill" size="lg" className="w-full">
                  <Sparkles aria-hidden />
                  Join the waitlist
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
