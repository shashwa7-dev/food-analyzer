import { requireUser } from "@/lib/session";
import { countActivity, getBalance, listActivity, periodChanges } from "@/lib/credits/ledger";
import { currentPeriod } from "@/lib/credits/logic";
import { balanceSeries } from "@/lib/credits/activity";
import { sweepStuck } from "@/lib/scans/service";
import { addDays, todayIn } from "@/lib/dates";
import { BackButton } from "@/components/nav/back-button";
import { BalanceChart } from "@/components/credits/balance-chart";
import { ActivityList } from "@/components/credits/activity-list";
import { PlanCards } from "@/components/credits/plan-cards";

const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="grid min-w-0 justify-items-center rounded-[20px] bg-surface px-1 py-2.5 text-center shadow-card">
      <b className="num text-[20px] leading-tight font-bold tracking-[-0.03em] text-ink">{value}</b>
      <span className="truncate text-[12px] whitespace-nowrap text-subtle">{label}</span>
    </div>
  );
}

/**
 * Scan credits (spec §6.14, mock "Credits & activity"): the plans (#pro) first, then the balance this
 * period as a step chart, used / free / refunded counts and the activity grouped by day.
 */
export default async function CreditsPage() {
  const { userId, profile } = await requireUser();
  await sweepStuck(userId); // a killed scan job's credit is refunded before the balance is shown
  const now = new Date();
  const [balance, txns, counts, firstPage] = await Promise.all([
    getBalance(userId, now),
    periodChanges(userId, now),
    countActivity(userId, now),
    listActivity(userId, "all"),
  ]);

  // The allowance period is a UTC month; the chart's days are the user's local days within it.
  const period = currentPeriod(now);
  const periodStart = `${period}-01`;
  const periodEnd = addDays(balance.periodResetsAt.toISOString().slice(0, 10), -1);
  const localToday = todayIn(profile.timezone, now);
  const today = localToday < periodStart ? periodStart : localToday > periodEnd ? periodEnd : localToday;
  // Closing balances work back from the live one through this period's scans and refunds. The grant
  // (and the old period's expiry beside it) is left out: it's written lazily on the month's first
  // visit, but the allowance belongs to the whole month, so the days before it read the full allowance.
  const series = balanceSeries(txns.filter((t) => t.type !== "grant" && t.type !== "expire"), periodStart, today, profile.timezone, balance.credits);
  const points: { date: string; balance: number | null; event: boolean }[] = [];
  for (let d = periodStart; d <= periodEnd; d = addDays(d, 1)) {
    const p = series.find((s) => s.date === d);
    points.push({ date: d, balance: p?.balance ?? null, event: p?.event ?? false });
  }
  const month = MONTH_LONG[Number(period.slice(5)) - 1]!;

  return (
    <div className="mx-auto grid w-full max-w-[640px] gap-3 md:gap-5">
      <div className="flex items-center justify-between gap-2.5">
        <BackButton fallback="/me" />
        <h1 className="m-0 min-w-0 truncate text-center text-[17px] font-semibold whitespace-nowrap text-ink">Scan credits</h1>
        <span className="size-11 shrink-0" aria-hidden />
      </div>

      <PlanCards />

      <BalanceChart credits={balance.credits} allowance={balance.allowance} month={month} points={points} today={today} end={periodEnd} />

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <Stat value={counts.used} label="used" />
        <Stat value={counts.free} label="free barcodes" />
        <Stat value={counts.refunded} label="refunded" />
      </div>

      <ActivityList initialPage={firstPage} tz={profile.timezone} now={now.toISOString()} />

    </div>
  );
}
