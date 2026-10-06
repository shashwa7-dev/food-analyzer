"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { api } from "@/lib/api-client";
import { GradeBadge } from "@/components/grade-badge";
import type { FoodHit } from "@/lib/foods/types";

function useDebounced<T>(v: T, ms: number) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

export function FoodSearch({ onPick, autoFocus }: { onPick: (hit: FoodHit) => void; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim(), 150);
  const recents = useQuery({ queryKey: ["foods", "recent"], queryFn: () => api<{ results: FoodHit[] }>("/api/v1/foods/recent") });
  const search = useQuery({ queryKey: ["foods", "search", dq], queryFn: () => api<{ results: FoodHit[] }>(`/api/v1/foods?q=${encodeURIComponent(dq)}`), enabled: dq.length >= 2 });
  const list = dq.length >= 2 ? search.data?.results : recents.data?.results;
  return (
    <div className="flex flex-col">
      <label htmlFor="food-q" className="flex min-h-[52px] items-center gap-2.5 rounded-md border border-line bg-surface px-3.5">
        <Search className="size-5 text-subtle" aria-hidden />
        <input id="food-q" type="search" autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: dal, chawal, coffee…" className="min-w-0 flex-1 bg-transparent text-base outline-none" autoComplete="off" />
      </label>
      <div className="mt-4 mb-1 text-sm text-subtle">{dq.length >= 2 ? (search.isFetching ? "Searching…" : `${list?.length ?? 0} results`) : "Recent"}</div>
      {dq.length >= 2 && search.data && list?.length === 0 && (
        <div className="rounded-lg border border-line bg-surface p-5"><b>No match for “{dq}”</b><p className="mt-1.5 text-sm text-subtle">Add it yourself — it’ll show up in search next time.</p></div>
      )}
      {dq.length < 2 && recents.data && list?.length === 0 && <p className="text-sm text-subtle">Foods you log will appear here for one-tap logging.</p>}
      <ul className="flex flex-col">
        {list?.map((h) => (
          <li key={h.id}>
            <button type="button" onClick={() => onPick(h)} className="flex min-h-[60px] w-full items-center gap-3.5 border-b border-line px-1 py-3.5 text-left">
              <GradeBadge grade={h.grade} />
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{h.name}{h.brand && <span className="font-normal text-subtle"> · {h.brand}</span>}</span>
                <span className="text-sm text-subtle">{h.defaultPortion.label}{h.defaultPortion.kcal !== null && <> · <span className="num">{h.defaultPortion.kcal}</span> kcal</>}</span></span>
              <span className="grid size-9 place-items-center rounded-md border border-line" aria-hidden><Plus className="size-[18px]" /></span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
