// Pure helpers for the credits page (spec §6.14): the activity list's day groups and the balance
// chart's daily series. No server imports, so they're safe in client bundles.
import { addDays, todayIn } from "@/lib/dates";

export type ActivityKind = "used" | "free" | "refund" | "grant";
export type ActivityFilter = "all" | "used" | "free" | "refunds";
export const ACTIVITY_FILTERS = ["all", "used", "free", "refunds"] as const satisfies readonly ActivityFilter[];

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  /** ISO timestamp. */
  at: string;
  title: string;
  meta: string;
  /** −1 used, 0 free, +n refund or grant. */
  amount: number;
  scanId: string | null;
  /** The scan exists and isn't deleted, so the row can open it. */
  linkable: boolean;
  /** The scan's input kind, for the row's icon; absent on grants. */
  inputKind?: "barcode" | "label" | "front" | "meal" | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayLabel = (d: string) => `${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;

/**
 * Activity grouped by the user's calendar day in `tz`, newest first: "Today", "Yesterday", then
 * "4 Oct". The sort is stable, so rows sharing a timestamp keep the server's order (a month's first
 * scan is debited in the grant's own transaction, and the debit is listed above the grant).
 */
export function groupActivity(items: ActivityItem[], tz: string, now: Date): { label: string; items: ActivityItem[] }[] {
  const today = todayIn(tz, now);
  const yesterday = addDays(today, -1);
  const sorted = [...items].sort((a, b) => b.at.localeCompare(a.at));
  const groups: { label: string; items: ActivityItem[] }[] = [];
  for (const it of sorted) {
    const d = todayIn(tz, new Date(it.at));
    const label = d === today ? "Today" : d === yesterday ? "Yesterday" : dayLabel(d);
    const last = groups.at(-1);
    if (last && last.label === label) last.items.push(it);
    else groups.push({ label, items: [it] });
  }
  return groups;
}

/**
 * The balance at the end of each local day from `periodStart` to `today` (inclusive), for a step
 * chart. `event` marks days with a ledger change. Transactions must arrive oldest first when they
 * share a timestamp (the sort is stable). The allowance period is a UTC month, so west of UTC its
 * first minutes fall on the previous local day: those changes fold into the starting balance.
 */
export function balanceSeries(
  txns: { at: string; balanceAfter: number }[],
  periodStart: string,
  today: string,
  tz: string,
  startBalance: number,
): { date: string; balance: number; event: boolean }[] {
  const lastByDay = new Map<string, number>();
  let bal = startBalance;
  for (const t of [...txns].sort((a, b) => a.at.localeCompare(b.at))) {
    const day = todayIn(tz, new Date(t.at));
    if (day < periodStart) bal = t.balanceAfter;
    else lastByDay.set(day, t.balanceAfter);
  }
  const out: { date: string; balance: number; event: boolean }[] = [];
  for (let d = periodStart; d <= today; d = addDays(d, 1)) {
    const ev = lastByDay.get(d);
    if (ev !== undefined) bal = ev;
    out.push({ date: d, balance: bal, event: ev !== undefined });
  }
  return out;
}
