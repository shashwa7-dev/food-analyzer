"use client";
// The credits page's activity (spec §6.14): filter pills (All, Used, Free, Refunds) over a list grouped
// by day. The server renders the first "All" page as initialData; every filter is its own
// useInfiniteQuery on GET /api/v1/credits/activity, with "Load more" following the cursor.
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Barcode, CalendarPlus, Loader2, Package, RotateCcw, ScanText, Soup, Sparkles, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconTile, type IconTileTone } from "@/components/ui/icon-tile";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { groupActivity, type ActivityFilter, type ActivityItem } from "@/lib/credits/activity";

type Page = { items: ActivityItem[]; nextCursor: string | null };

const FILTERS: { key: ActivityFilter; label: string; icon?: LucideIcon }[] = [
  { key: "all", label: "All" },
  { key: "used", label: "Used", icon: Sparkles },
  { key: "free", label: "Free", icon: Barcode },
  { key: "refunds", label: "Refunds", icon: RotateCcw },
];

const EMPTY: Record<ActivityFilter, string> = {
  all: "No activity yet. Scans you make show up here.",
  used: "No AI scans used yet.",
  free: "No barcode scans yet. They're always free.",
  refunds: "No refunds. Scans that fail are refunded automatically.",
};

const SCAN_ICON: Record<string, LucideIcon> = { meal: Soup, label: ScanText, front: Package, barcode: Barcode };

function tileFor(it: ActivityItem): { icon: LucideIcon; tone: IconTileTone } {
  if (it.kind === "free") return { icon: Barcode, tone: "brand" };
  if (it.kind === "refund") return { icon: RotateCcw, tone: "good" };
  if (it.kind === "grant") return { icon: CalendarPlus, tone: "neutral" };
  return { icon: SCAN_ICON[it.inputKind ?? ""] ?? Sparkles, tone: "neutral" };
}

/**
 * −1 on --sunken, Free on brand-soft, +n in the A-grade green (mock `.amt`). A refund reads "Refunded",
 * not "+1": its scan's debit row is left out of the list, so a "+1" would make the rows add up to more
 * than the balance (review M7).
 */
function AmountPill({ it }: { it: ActivityItem }) {
  const free = it.kind === "free";
  const refund = it.kind === "refund";
  const label = free ? "Free" : refund ? "Refunded" : it.amount > 0 ? `+${it.amount}` : `−${Math.abs(it.amount)}`;
  const spoken = free ? "free" : refund ? "refunded, no credit used" : it.amount > 0 ? `${it.amount} back` : `${Math.abs(it.amount)} used`;
  return (
    <span
      className={cn(
        "num shrink-0 rounded-full px-2.5 py-[5px] text-[13.5px] font-[650] whitespace-nowrap",
        free ? "bg-brand-soft text-on-brand-soft" : refund || it.amount > 0 ? "bg-grade-a/15 text-good-ink" : "bg-sunken text-ink",
      )}
    >
      <span aria-hidden>{label}</span>
      <span className="sr-only">{spoken}</span>
    </span>
  );
}

function Row({ it }: { it: ActivityItem }) {
  const { icon: Icon, tone } = tileFor(it);
  const quiet = it.kind === "grant";
  const body = (
    <>
      <IconTile tone={tone}><Icon /></IconTile>
      <span className="min-w-0 flex-1 leading-tight">
        <b className="block truncate text-[14.5px] font-semibold text-ink">{it.title}</b>
        <span className="block truncate text-[12.5px] text-subtle">{it.meta}</span>
      </span>
      <AmountPill it={it} />
    </>
  );
  const cls = cn(
    "flex min-h-[60px] items-center gap-3 rounded-[18px] px-3 py-2.5",
    quiet ? "border border-dashed border-line" : "bg-surface shadow-card",
  );
  return (
    <li>
      {it.linkable && it.scanId ? (
        <Link href={`/scans/${it.scanId}`} className={cn(cls, "transition-colors hover:bg-sunken/40")}>{body}</Link>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="m-0 px-1 py-2 text-sm text-subtle">{children}</p>;
}

export function ActivityList({ initialPage, tz, now: nowIso }: { initialPage: Page; tz: string; now: string }) {
  // The server's render time, held once so server and client group "Today" the same way.
  const [now] = useState(() => new Date(nowIso));
  const nowMs = now.getTime();
  const [filter, setFilter] = useState<ActivityFilter>("all");

  const query = useInfiniteQuery({
    queryKey: ["credits", "activity", filter] as const,
    queryFn: ({ pageParam }) => {
      const sp = new URLSearchParams({ filter });
      if (pageParam) sp.set("cursor", pageParam);
      return api<Page>(`/api/v1/credits/activity?${sp}`);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialData: filter === "all" ? { pages: [initialPage], pageParams: [undefined] } : undefined,
    initialDataUpdatedAt: filter === "all" ? nowMs : undefined,
  });

  // initialData only seeds a cold cache: a warm one from an earlier visit predates this server page
  // (a scan since then changed the ledger), so refetch it once on mount — as /history does.
  const staleCheckDone = useRef(false);
  useEffect(() => {
    if (staleCheckDone.current) return;
    staleCheckDone.current = true;
    if (query.dataUpdatedAt > 0 && query.dataUpdatedAt < nowMs) void query.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally mount-only, guarded above
  }, []);

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const groups = groupActivity(items, tz, now);

  return (
    <section aria-label="Activity" className="grid gap-3">
      <div role="group" aria-label="Show" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
        {FILTERS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className="group/f flex min-h-11 min-w-11 shrink-0 items-center justify-center outline-none!"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-2 text-[13px] font-semibold whitespace-nowrap text-subtle transition-colors group-hover/f:text-ink group-focus-visible/f:ring-2 group-focus-visible/f:ring-brand-deep group-aria-pressed/f:border-transparent group-aria-pressed/f:bg-action group-aria-pressed/f:text-action-ink [&_svg]:size-[15px]">
              {Icon && <Icon aria-hidden />}
              {label}
            </span>
          </button>
        ))}
      </div>

      {query.isPending ? (
        <Note><span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />Loading…</span></Note>
      ) : query.isError && items.length === 0 ? (
        <p role="alert" className="m-0 px-1 py-2 text-sm text-bad">Couldn’t load your activity. Try again.</p>
      ) : groups.length === 0 ? (
        <Note>{EMPTY[filter]}</Note>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5">
          {groups.map((g) => (
            <div key={g.label} className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
              <h3 className="m-0 pl-1 text-[12px] font-[650] text-subtle">{g.label}</h3>
              <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-1.5 p-0">
                {g.items.map((it) => <Row key={it.id} it={it} />)}
              </ul>
            </div>
          ))}
        </div>
      )}

      {query.hasNextPage && (
        <Button
          type="button"
          variant="ghost-sunken"
          shape="pill"
          size="lg"
          className="w-full"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />}
          {query.isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      )}
    </section>
  );
}
