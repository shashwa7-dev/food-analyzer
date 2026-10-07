"use client";
// /history's list: server-rendered first page as the unfiltered useInfiniteQuery's initialData,
// a debounced search box and grade chips (both reset pagination by changing the query key), and a
// client-side "Load more" using the cursor from GET /api/v1/scans.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2, ScanLine, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { relativeDate } from "@/lib/dates";
import { confidenceLabel, inputKindLabel } from "@/lib/scans/history";
import type { ScanListItem } from "@/lib/scans/service";
import { GradeBadge } from "@/components/grade-badge";

type Page = { scans: ScanListItem[]; nextCursor: string | null };
type Grade = "A" | "B" | "C" | "D" | "E";
const GRADES: readonly Grade[] = ["A", "B", "C", "D", "E"];

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

function ScanRow({ s }: { s: ScanListItem }) {
  const running = isRunning(s.status);
  const failed = s.status === "failed";
  const title = running ? "Analysing…" : failed ? (s.errorCode === "BARCODE_NOT_FOUND" ? "Barcode not found" : "Scan failed") : s.name ?? "Scan";
  const meta = [relativeDate(s.createdAt), inputKindLabel(s.inputKind), !running && !failed ? confidenceLabel(s.confidence) : null].filter((v): v is string => !!v);
  return (
    <li className="border-b border-line last:border-b-0">
      <Link href={`/scans/${s.id}`} className="flex min-h-14 items-center gap-3.5 px-3.5 py-3">
        {running ? (
          <span className="grid size-[30px] shrink-0 place-items-center rounded-sm bg-sunken text-subtle" aria-label="Analysing">
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
          </span>
        ) : failed ? (
          <span className="grid size-[30px] shrink-0 place-items-center rounded-sm bg-sunken text-bad" aria-label="Failed">
            <AlertCircle className="size-[18px]" aria-hidden />
          </span>
        ) : (
          <GradeBadge grade={s.grade} />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">
            {title}
            {s.brand && !running && !failed && <span className="font-normal text-subtle"> · {s.brand}</span>}
          </span>
          {meta.length > 0 && <span className="block text-sm text-subtle">{meta.join(" · ")}</span>}
        </span>
      </Link>
    </li>
  );
}

export function ScanList({ initialPage }: { initialPage: Page }) {
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
  });

  const scans = query.data?.pages.flatMap((p) => p.scans) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <label className="flex min-h-[52px] items-center gap-2.5 rounded-md border border-line bg-surface px-3.5">
        <Search className="size-5 text-subtle" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your scans"
          className="min-w-0 flex-1 bg-transparent text-base outline-none"
          autoComplete="off"
          aria-label="Search your scans"
        />
      </label>
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        <button
          type="button"
          aria-pressed={grade === undefined}
          onClick={() => setGrade(undefined)}
          className={cn(
            "min-h-11 shrink-0 rounded-full border px-3.5 text-sm font-semibold",
            grade === undefined ? "border-transparent bg-accent text-accent-ink" : "border-line bg-surface text-ink",
          )}
        >
          All
        </button>
        {GRADES.map((g) => (
          <button
            key={g}
            type="button"
            aria-pressed={grade === g}
            onClick={() => setGrade((cur) => (cur === g ? undefined : g))}
            className={cn(
              "min-h-11 min-w-11 shrink-0 rounded-full border px-3.5 text-sm font-semibold",
              grade === g ? "border-transparent bg-accent text-accent-ink" : "border-line bg-surface text-ink",
            )}
          >
            {g}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <p className="text-sm text-subtle">Loading…</p>
      ) : query.isError ? (
        <p role="alert" className="text-sm text-bad">Couldn’t load your scans. Try again.</p>
      ) : scans.length === 0 ? (
        filtered ? (
          <p className="text-sm text-subtle">No scans match your search.</p>
        ) : (
          <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5 shadow-card">
            <p>No scans yet — scan a barcode or a label to see it here.</p>
            <Link href="/scan" className="flex min-h-12 items-center justify-center gap-1.5 rounded-lg bg-accent px-4 font-semibold text-accent-ink">
              <ScanLine className="size-[18px]" aria-hidden /> Scan
            </Link>
          </div>
        )
      ) : (
        <ul className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
          {scans.map((s) => (
            <ScanRow key={s.id} s={s} />
          ))}
        </ul>
      )}

      {query.hasNextPage && (
        <button
          type="button"
          onClick={() => query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
          className="min-h-12 rounded-lg border border-line bg-surface font-semibold text-accent disabled:opacity-50"
        >
          {query.isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
