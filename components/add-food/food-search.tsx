"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Barcode, ChevronRight, Clock, Loader2, Plus, Search, Star, Zap, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { FoodRow } from "@/components/add-food/food-row";
import { QuickAddForm } from "@/components/add-food/quick-add-form";
import { useLogEntry } from "@/components/food/use-log-entry";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { FoodHit } from "@/lib/foods/types";
import type { Meal } from "@/lib/nutrition/types";

type Tab = "results" | "recent" | "mine" | "quick";
const TABS: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: "results", label: "Results", icon: Search },
  { key: "recent", label: "Recent", icon: Clock },
  { key: "mine", label: "My foods", icon: Star },
  { key: "quick", label: "Quick add", icon: Zap },
];
const ADDED_MS = 2000;

/** A set of ids that each drop out `ms` after they were last flashed (the quick-add check). */
function useFlashSet(ms: number): [Set<string>, (id: string) => void] {
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);
  const flash = useCallback((id: string) => {
    setIds((s) => new Set(s).add(id));
    clearTimeout(timers.current.get(id));
    timers.current.set(id, setTimeout(() => setIds((s) => { const next = new Set(s); next.delete(id); return next; }), ms));
  }, [ms]);
  return [ids, flash];
}

function useDebounced<T>(v: T, ms: number) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

const card = "rounded-[22px] bg-surface shadow-card";

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="m-0 px-1 py-2 text-sm text-subtle">{children}</p>;
}

/**
 * Recent foods, queried only while this tab is mounted: adds mark recents stale without refetching
 * (useLogEntry), so the list holds still after a quick add and refreshes the next time it mounts.
 */
function RecentPanel({ rows }: { rows: (list: FoodHit[]) => React.ReactNode }) {
  const recents = useQuery({ queryKey: ["foods", "recent"], queryFn: () => api<{ results: FoodHit[] }>("/api/v1/foods/recent") });
  if (recents.isPending) return <Muted>Loading…</Muted>;
  if (recents.isError) return <Muted>Couldn’t load your recent foods. Try again.</Muted>;
  if (recents.data.results.length === 0) return <Muted>Foods you log will appear here for one-tap logging.</Muted>;
  return rows(recents.data.results);
}

/**
 * The food search body (spec §6.2): the autofocused search box with its barcode button, the tabs
 * (Results while there's a query; Recent by default), and each tab's list of FoodRows. Tapping a row
 * calls `onOpen` (the add sheet); its round button quick-adds the default portion to `meal` on `date`.
 */
export function FoodSearch({ meal, date, onOpen }: { meal: Meal; date: string; onOpen: (hit: FoodHit) => void }) {
  const ids = useId();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("recent");
  const [added, flashAdded] = useFlashSet(ADDED_MS);
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const logEntry = useLogEntry();

  const typed = q.trim();
  const dq = useDebounced(typed, 150);
  const hasQuery = typed.length > 0;
  const active: Tab = tab === "results" && !hasQuery ? "recent" : tab;

  const mine = useQuery({ queryKey: ["foods", "mine"], queryFn: () => api<{ results: FoodHit[] }>("/api/v1/foods/mine"), enabled: active === "mine" });
  const search = useQuery({
    queryKey: ["foods", "search", dq],
    queryFn: () => api<{ results: FoodHit[] }>(`/api/v1/foods?q=${encodeURIComponent(dq)}`),
    enabled: dq.length >= 2,
    placeholderData: (prev) => prev, // keep the last list while the next keystroke's results load
  });

  const toggle = (set: Set<string>, id: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  };

  async function quickAdd(hit: FoodHit) {
    const { index, grams } = hit.defaultPortion;
    // No weight on the default portion (or an old hit without its index): pick the amount in the sheet.
    if (index === undefined || grams === null) return onOpen(hit);
    setPending((s) => toggle(s, hit.id, true));
    const id = await logEntry({ kind: "food", date, meal, foodId: hit.id, portionIndex: index, quantity: 1 }, { name: hit.name, meal });
    setPending((s) => toggle(s, hit.id, false));
    if (id) flashAdded(hit.id);
  }

  const rows = (list: FoodHit[]) => (
    <ul className={cn(card, "m-0 list-none divide-y divide-line p-0 py-1")}>
      {list.map((h) => (
        <FoodRow key={h.id} food={h} added={added.has(h.id)} pending={pending.has(h.id)} onOpen={() => onOpen(h)} onQuickAdd={() => void quickAdd(h)} />
      ))}
    </ul>
  );

  const visibleTabs = TABS.filter((t) => t.key !== "results" || hasQuery);
  const scanParams = new URLSearchParams({ mode: "barcode", meal, date });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-[52px] items-center gap-2.5 rounded-[18px] bg-surface pr-1 pl-4 ring-2 ring-brand-deep">
        <Search className="size-5 shrink-0 text-subtle" aria-hidden />
        <label htmlFor={`${ids}-q`} className="sr-only">Search foods</label>
        <input
          id={`${ids}-q`}
          type="search"
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (e.target.value.trim() && tab !== "results") setTab("results");
          }}
          placeholder="Search: dal, chawal, coffee…"
          autoComplete="off"
          enterKeyHint="search"
          className="h-full min-w-0 flex-1 bg-transparent text-base font-medium text-ink outline-none! placeholder:font-normal placeholder:text-subtle [&::-webkit-search-cancel-button]:hidden"
        />
        <Link href={`/scan?${scanParams}`} aria-label="Scan a barcode" className="group/bar grid size-11 shrink-0 place-items-center rounded-[14px] outline-none!">
          <span className="grid size-10 place-items-center rounded-[12px] bg-brand-soft text-brand-deep group-focus-visible/bar:ring-2 group-focus-visible/bar:ring-brand-deep">
            <Barcode className="size-5" aria-hidden />
          </span>
        </Link>
      </div>

      <div role="tablist" aria-label="Find food" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
        {visibleTabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`${ids}-tab-${key}`}
            aria-selected={active === key}
            aria-controls={`${ids}-panel`}
            onClick={() => setTab(key)}
            className="group/tab flex min-h-11 shrink-0 items-center outline-none!"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-2 text-[13px] font-semibold whitespace-nowrap text-subtle transition-colors group-hover/tab:text-ink group-focus-visible/tab:ring-2 group-focus-visible/tab:ring-brand-deep group-aria-selected/tab:border-transparent group-aria-selected/tab:bg-action group-aria-selected/tab:text-action-ink [&_svg]:size-[15px]">
              <Icon aria-hidden />
              {label}
            </span>
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`${ids}-panel`} aria-labelledby={`${ids}-tab-${active}`} className="flex flex-col gap-3">
        {active === "results" && (
          <>
            <p className="sr-only" aria-live="polite">
              {dq.length >= 2 && search.data ? `${search.data.results.length} results` : ""}
            </p>
            {typed.length < 2 && <Muted>Keep typing…</Muted>}
            {typed.length >= 2 && (search.isPending || (search.isFetching && !search.data)) && (
              <p className="m-0 flex items-center gap-2 px-1 py-2 text-sm text-subtle">
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> Searching…
              </p>
            )}
            {typed.length >= 2 && search.isError && <Muted>Search isn’t working right now. Try again.</Muted>}
            {typed.length >= 2 && search.data && search.data.results.length > 0 && rows(search.data.results)}
            {typed.length >= 2 && search.data && search.data.results.length === 0 && !search.isFetching && (
              <div className={cn(card, "flex flex-col gap-3 p-5")}>
                <div>
                  <b className="block text-ink">No match for “{dq}”</b>
                  <p className="m-0 mt-1 text-sm text-subtle">Add it yourself. It’ll show up in search next time.</p>
                </div>
                <div className="flex gap-2">
                  <Button render={<Link href="/foods/new" />} nativeButton={false} variant="ghost-sunken" shape="pill" size="lg" className="min-w-0 flex-1 px-4">
                    <Plus aria-hidden /> Create a food
                  </Button>
                  <Button type="button" variant="ghost-sunken" shape="pill" size="lg" className="min-w-0 flex-1 px-4" onClick={() => setTab("quick")}>
                    <Zap aria-hidden /> Quick add
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {active === "recent" && <RecentPanel rows={rows} />}

        {active === "mine" && (
          <>
            <Link href="/foods/new" className={cn(card, "flex min-h-[60px] items-center gap-2.5 px-3 py-2.5")}>
              <IconTile tone="brand"><Plus /></IconTile>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[14.5px] font-semibold text-ink">Create a food</span>
                <span className="block truncate text-[12.5px] text-subtle">Your recipe or a pack we don’t have</span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-subtle" aria-hidden />
            </Link>
            {mine.isPending && <Muted>Loading…</Muted>}
            {mine.data && mine.data.results.length === 0 && <Muted>Foods you create or save from a scan live here.</Muted>}
            {mine.data && mine.data.results.length > 0 && rows(mine.data.results)}
          </>
        )}

        {active === "quick" && <QuickAddForm date={date} meal={meal} />}
      </div>
    </div>
  );
}
