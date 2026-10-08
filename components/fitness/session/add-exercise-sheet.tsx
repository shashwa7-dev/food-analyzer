"use client";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ResponsiveSheet, SheetTitle } from "@/components/ui/responsive-sheet";
import { EXERCISES, type MuscleGroup } from "@/lib/fitness/catalogue";

const GROUPS: { key: MuscleGroup; label: string }[] = [
  { key: "chest", label: "Chest" },
  { key: "back", label: "Back" },
  { key: "legs", label: "Legs" },
  { key: "shoulders", label: "Shoulders" },
  { key: "arms", label: "Arms" },
  { key: "core", label: "Core" },
];
const ROW = "flex min-h-11 w-full items-center gap-2.5 rounded-[12px] px-3 text-left text-[14.5px] font-semibold whitespace-nowrap text-ink transition-colors hover:bg-sunken [&_svg]:size-[18px]";

function Body({ onPick }: { onPick: (exerciseKey: string | null, name: string) => void }) {
  const [query, setQuery] = useState("");
  const q = query.trim();
  const needle = q.toLowerCase();
  const matches = EXERCISES.filter((e) => e.name.toLowerCase().includes(needle));
  const exact = matches.some((e) => e.name.toLowerCase() === needle);

  return (
    <>
      <SheetTitle className="m-0 text-[18px] font-semibold tracking-[-0.02em] text-ink">Add exercise</SheetTitle>
      <label className="flex h-12 items-center gap-2 rounded-[14px] bg-sunken px-3.5 text-subtle has-focus-visible:ring-2 has-focus-visible:ring-ring [&_svg]:size-[18px]">
        <Search aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises"
          aria-label="Search exercises"
          maxLength={80}
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none! placeholder:text-subtle"
        />
      </label>
      {q && !exact && (
        <button type="button" className={cn(ROW, "text-brand-deep")} onClick={() => onPick(null, q)}>
          <Plus aria-hidden />
          <span className="min-w-0 truncate">Add “{q}” as a custom exercise</span>
        </button>
      )}
      <div className="flex flex-col gap-2">
        {GROUPS.map((g) => {
          const items = matches.filter((e) => e.group === g.key);
          if (items.length === 0) return null;
          return (
            <section key={g.key} aria-label={g.label}>
              <h3 className="m-0 px-3 pb-1 text-[11px] font-semibold tracking-[.05em] text-subtle uppercase">{g.label}</h3>
              <ul className="m-0 list-none p-0">
                {items.map((e) => (
                  <li key={e.key}>
                    <button type="button" className={ROW} onClick={() => onPick(e.key, e.name)}>
                      <span className="min-w-0 truncate">{e.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {matches.length === 0 && <p className="m-0 px-3 text-[14px] text-subtle">No catalogue match.</p>}
      </div>
    </>
  );
}

/** "Add exercise": search the catalogue by muscle group, or add the query as a custom exercise. */
export function AddExerciseSheet({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (open: boolean) => void; onPick: (exerciseKey: string | null, name: string) => void }) {
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange}>
      <Body onPick={onPick} />
    </ResponsiveSheet>
  );
}
