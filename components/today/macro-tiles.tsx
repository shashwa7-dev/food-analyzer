import { Droplet, Drumstick, Wheat, type LucideIcon } from "lucide-react";
import { toneFor } from "@/lib/today/tone";
import { cn } from "@/lib/utils";

export type MacroAmount = { eaten: number; target: number };

const MACROS: { key: "protein" | "carbs" | "fat"; label: string; icon: LucideIcon; text: string; bar: string; track: string }[] = [
  { key: "protein", label: "Protein", icon: Drumstick, text: "text-protein", bar: "bg-protein", track: "bg-protein/18" },
  { key: "carbs", label: "Carbs", icon: Wheat, text: "text-carbs", bar: "bg-carbs", track: "bg-carbs/18" },
  { key: "fat", label: "Fat", icon: Droplet, text: "text-fat", bar: "bg-fat", track: "bg-fat/18" },
];

/** Three macro tiles (spec §6.1): icon and name, a 6 px bar in the macro's colour, "{eaten} / {target} g"; the eaten number turns bad over target for carbs and fat; protein over target is not a problem, so it never turns bad (the bar stays full in the macro colour). */
export function MacroTiles({ protein, carbs, fat }: Record<"protein" | "carbs" | "fat", MacroAmount>) {
  const values = { protein, carbs, fat };
  return (
    <div className="grid grid-cols-3 gap-2 md:gap-4">
      {MACROS.map(({ key, label, icon: Icon, text, bar, track }) => {
        const { eaten, target } = values[key];
        const pct = target > 0 ? Math.min(eaten / target, 1) * 100 : 0;
        return (
          <section
            key={key}
            aria-label={`${label}: ${Math.round(eaten)} of ${Math.round(target)} grams`}
            className="grid min-w-0 gap-2 rounded-[24px] bg-surface p-3 shadow-card md:p-4"
          >
            <span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[13px] font-[550] text-ink">
              <Icon className={cn("size-4 shrink-0", text)} aria-hidden />
              {label}
            </span>
            <div className={cn("h-1.5 overflow-hidden rounded-full", track)} aria-hidden>
              <div className={cn("h-full rounded-full", bar)} style={{ width: `${pct}%` }} />
            </div>
            <span className="num whitespace-nowrap text-base font-[650] tracking-[-0.02em] text-ink" aria-hidden>
              <span className={cn(key !== "protein" && toneFor(eaten, target) === "over" && "text-bad")}>{Math.round(eaten)}</span>
              <small className="text-[11.5px] font-medium tracking-normal text-subtle"> / {Math.round(target)} g</small>
            </span>
          </section>
        );
      })}
    </div>
  );
}
