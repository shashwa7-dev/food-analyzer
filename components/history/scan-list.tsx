"use client";
// /history's list: server-rendered first page as the unfiltered useInfiniteQuery's initialData,
// a debounced search box and grade chips (both reset pagination by changing the query key), and a
// client-side "Load more" using the cursor from GET /api/v1/scans.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { AlertCircle, ChevronRight, Loader2, ScanLine, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { relativeDate } from "@/lib/dates";
import { confidenceLabel, inputKindLabel } from "@/lib/scans/history";
import type { ScanListItem } from "@/lib/scans/service";
import { GradeBadge } from "@/components/grade-badge";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";

type Page = { scans: ScanListItem[]; nextCursor: string | null };
type Grade = "A" | "B" | "C" | "D" | "E";
const GRADES: readonly Grade[] = ["A", "B", "C", "D", "E"];
const GRADE_DOT: Record<Grade, string> = { A: "bg-grade-a", B: "bg-grade-b", C: "bg-grade-c", D: "bg-grade-d", E: "bg-grade-e" };

function useDebounced<T>(v: T, ms: number) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

function isRunning(status: ScanListItem["status"]) {
  return status === "queued" || status === "processing";
}

/** A History row (mock-c1 `.arow`): a white card with the grade badge (or a status tile), the name and one meta line. */
function ScanRow({ s, tz, now }: { s: ScanListItem; tz: string; now: Date }) {
  const running = isRunning(s.status);
  const failed = s.status === "failed" || s.errorCode !== null; // BARCODE_NOT_FOUND rows are done with no result
  const title = running ? "Analysing…" : failed ? (s.errorCode === "BARCODE_NOT_FOUND" ? "Barcode not found" : "Scan failed") : s.name ?? "Scan";
  const meta = [relativeDate(s.createdAt, tz, now), inputKindLabel(s.inputKind), !running && !failed ? confidenceLabel(s.confidence) : null].filter((v): v is string => !!v);
  return (
    <li>
      <Link href={`/scans/${s.id}`} className="flex min-h-[64px] items-center gap-3 rounded-[18px] bg-surface px-3 py-2.5 shadow-card transition-colors hover:bg-sunken/40">
        {running ? (
          <IconTile size="md"><Loader2 className="animate-spin motion-reduce:animate-none" /></IconTile>
        ) : failed ? (
          <IconTile size="md" tone="bad"><AlertCircle /></IconTile>
        ) : (
          <GradeBadge grade={s.grade} size="md" />
        )}
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[15px] font-semibold text-ink">
            {title}
            {s.brand && !running && !failed && <span className="font-normal text-subtle"> · {s.brand}</span>}
          </span>
          {meta.length > 0 && <span className="mt-0.5 block truncate text-[12.5px] text-subtle">{meta.join(" · ")}</span>}
        </span>
        <ChevronRight className="size-[18px] shrink-0 text-subtle" aria-hidden />
      </Link>
    </li>
  );
}

/** A filter pill (mock-c1 `.tabs`): 44 px hit area around a smaller pill; the active one in the action colour. */
function FilterPill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className="group/f flex min-h-11 shrink-0 items-center outline-none!">
      <span className="inline-flex min-w-9 items-center justify-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap text-subtle transition-colors group-hover/f:text-ink group-focus-visible/f:ring-2 group-focus-visible/f:ring-brand-deep group-aria-pressed/f:border-transparent group-aria-pressed/f:bg-action group-aria-pressed/f:text-action-ink">
        {children}
      </span>
    </button>
  );
}

export function ScanList({ initialPage, tz, now: nowIso }: { initialPage: Page; tz: string; now: string }) {
  // Hold the server's render time once, rather than calling `new Date()` on every render: the
  // server-rendered HTML and the client's first hydration pass must compute the same relative
  // dates, or React flags a hydration mismatch (e.g. server says "59 min ago", client "1 h ago").
  const [now] = useState(() => new Date(nowIso));
  const nowMs = now.getTime();
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState<Grade | undefined>(undefined);
  const dq = useDebounced(q.trim(), 300);
  const filtered = dq.length > 0 || grade !== undefined;

  const query = useInfiniteQuery({
    queryKey: ["scans", "history", { q: dq, grade }] as const,
    queryFn: ({ pageParam }) => {
      const sp = new URLSearchParams();
      if (pageParam) sp.set("cursor", pageParam);
      if (grade) sp.set("grade", grade);
      if (dq) sp.set("q", dq);
      return api<Page>(`/api/v1/scans?${sp}`);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialData: !filtered ? { pages: [initialPage], pageParams: [undefined] } : undefined,
    initialDataUpdatedAt: !filtered ? nowMs : undefined,
  });

  // `initialData` only seeds the cache the first time this exact query key is ever observed in
  // this QueryClient; once warm (e.g. the user visited /history earlier this session, scanned
  // something, then came back) React Query keeps showing that older cached page and ignores the
  // fresh `initialPage` this render just got from the server. Creating a scan already invalidates
  // ["scans"] (scan-flow.tsx, scan-progress.tsx), which refetches an *active* history query
  // immediately — but a query that wasn't mounted at that moment is only marked stale, not
  // refetched. This is the belt-and-suspenders check for that case: on mount, if the cache
  // predates the server page we were just given, refetch once.
  const staleCheckDone = useRef(false);
  useEffect(() => {
    if (staleCheckDone.current) return;
    staleCheckDone.current = true;
    if (!filtered && query.dataUpdatedAt > 0 && query.dataUpdatedAt < nowMs) void query.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally mount-only, guarded above
  }, []);

  const scans = query.data?.pages.flatMap((p) => p.scans) ?? [];

  return (
    <div className="flex flex-col gap-3">
      <label className="flex h-[52px] items-center gap-2.5 rounded-[18px] border border-line bg-surface pr-1 pl-4 focus-within:border-transparent focus-within:ring-2 focus-within:ring-brand-deep">
        <Search className="size-5 shrink-0 text-subtle" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your scans"
          className="h-full min-w-0 flex-1 bg-transparent text-base font-medium text-ink outline-none! placeholder:font-normal placeholder:text-subtle"
          autoComplete="off"
          aria-label="Search your scans"
        />
      </label>
      <div role="group" aria-label="Grade" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
        <FilterPill on={grade === undefined} onClick={() => setGrade(undefined)}>All</FilterPill>
        {GRADES.map((g) => (
          <FilterPill key={g} on={grade === g} onClick={() => setGrade((cur) => (cur === g ? undefined : g))}>
            <span className={cn("size-2 rounded-full", GRADE_DOT[g])} aria-hidden />
            {g}
          </FilterPill>
        ))}
      </div>

      {query.isLoading ? (
        <p className="m-0 inline-flex items-center gap-2 px-1 py-2 text-sm text-subtle"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />Loading…</p>
      ) : query.isError ? (
        <p role="alert" className="m-0 px-1 py-2 text-sm text-bad">Couldn’t load your scans. Try again.</p>
      ) : scans.length === 0 ? (
        filtered ? (
          <p className="m-0 px-1 py-2 text-sm text-subtle">No scans match your search.</p>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-[24px] bg-surface px-5 py-7 text-center shadow-card">
            <IconTile tone="brand" size="lg"><ScanLine /></IconTile>
            <div className="leading-snug">
              <b className="block text-[17px] font-semibold text-ink">No scans yet</b>
              <p className="m-0 mt-1 text-sm text-subtle">Scan a barcode, a label or a meal to see it here.</p>
            </div>
            <Button render={<Link href="/scan" />} nativeButton={false} shape="pill" size="lg" className="mt-1 px-6">
              <ScanLine aria-hidden />
              Scan food
            </Button>
          </div>
        )
      ) : (
        <ul className="m-0 grid list-none gap-1.5 p-0">
          {scans.map((s) => (
            <ScanRow key={s.id} s={s} tz={tz} now={now} />
          ))}
        </ul>
      )}

      {query.hasNextPage && (
        <Button type="button" variant="ghost-sunken" shape="pill" size="lg" className="w-full" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>
          {query.isFetchingNextPage && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />}
          {query.isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}
