// Result parts shared by a scan result (/scans/[id]) and a food's page (/foods/[id]), after mock-c1:
// the title, the one-line verdict, big calories, the macro cards, the "More nutrients" and
// "Vitamins & minerals" cards, the better pick and the sticky action bar. Server-safe: no hooks, data comes in as props.
import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Droplet, Drumstick, Leaf, Lightbulb, Wheat, type LucideIcon } from "lucide-react";
import { dietChip, macroShare, verdict } from "@/lib/scans/result-display";
import { formatAmount, type Level, type NutrientRow } from "@/lib/nutrition/nutrient-display";
import type { FoodIconKey } from "@/lib/foods/icon";
import type { Diet, Flag, Grade, Nutrients } from "@/lib/nutrition/types";
import { GradeBadge } from "@/components/grade-badge";
import { GRADE_UNAVAILABLE } from "@/lib/nutrition/grade-unavailable";
import { NutrientFold } from "@/components/food/nutrient-fold";
import { cn } from "@/lib/utils";

/** A white result card (mock-c1 `.card`). */
export const CARD = "rounded-[24px] bg-surface p-[18px] shadow-card";

export const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");
/** Grams for a ring centre: one decimal under 10 g, whole grams above (the mock's "18.5g", "47g"). */
const grams = (n: number) => (n < 10 ? String(Math.round(n * 10) / 10) : String(Math.round(n)));

/* ---------- tags ---------- */

/** The category chip's word for each food icon. */
export const CATEGORY: Record<FoodIconKey, string> = {
  package: "Packaged", drink: "Drink", bowl: "Dish", wheat: "Bread", milk: "Dairy", egg: "Egg", fruit: "Fruit", snack: "Snack", default: "Food",
};

export function Tag({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[11.5px] font-semibold tracking-[0.06em] whitespace-nowrap text-ink uppercase">
      <Icon className="size-3.5 shrink-0 text-subtle" aria-hidden />
      <span className="truncate">{children}</span>
    </span>
  );
}

/** The tag row: centred, or left-aligned under a photo hero (`align="start"`). */
export function Tags({ children, align = "center" }: { children: ReactNode; align?: "center" | "start" }) {
  return <div className={cn("flex flex-wrap gap-1.5", align === "center" ? "justify-center" : "justify-start")}>{children}</div>;
}

/**
 * A food page's title (mock-c1 "Food detail" C): the name, left-aligned, and one muted meta line
 * ("Amul · Packaged · per 100 g"). A long name steps down a size and stops at three lines.
 */
export function FoodTitle({ name, meta }: { name: string; meta: string }) {
  const long = name.length > 40;
  return (
    <header className="min-w-0">
      <h1
        title={long ? name : undefined}
        className={cn("title m-0 line-clamp-3 leading-[1.1] font-[650] tracking-[-0.035em] break-words text-ink", long ? "text-[24px]" : "text-[30px]")}
      >
        {name}
      </h1>
      <p className="m-0 mt-1 line-clamp-2 text-[13px] text-subtle">{meta}</p>
    </header>
  );
}

/**
 * The one-line grade (replaces the hero on a food page): the badge, the verdict and its one reason,
 * and an optional chip on the right (the diet chip). With `unavailable` the badge is the neutral "?"
 * and the reason is why.
 */
export function VerdictLine({ grade, reason, unavailable, chip }: { grade: Grade | null; reason: string | null; unavailable?: string | null; chip?: ReactNode }) {
  return (
    <section className="flex items-center gap-3.5" aria-label="Grade">
      <GradeBadge grade={unavailable ? GRADE_UNAVAILABLE : grade} size="md" />
      <p className="m-0 min-w-0 flex-1 text-[13.5px] leading-[1.35] text-subtle">
        <b className="block text-[17px] font-semibold text-ink">{unavailable ? "Grade unavailable" : verdict(grade)}</b>
        {unavailable ?? reason}
      </p>
      {chip}
    </section>
  );
}

/** The diet chip ("Veg", "Not Vegan") for the verdict line, only where lib/scans/result-display.ts dietChip allows one. */
export function DietChip({ diet, flags, ingredientsKnown }: { diet: Diet; flags: Flag[]; ingredientsKnown: boolean }) {
  const fit = dietChip(diet, flags, ingredientsKnown);
  if (!fit) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sunken px-3 py-[7px] text-[13px] font-semibold whitespace-nowrap text-ink">
      <Leaf className={cn("size-[15px]", fit.fits ? "text-ok" : "text-bad")} aria-hidden />
      {fit.label}
    </span>
  );
}

/** Big calories ("289 kcal per 100 g") and, when there is one, the typical portion's ("1 katori = 220 kcal"). */
export function BigCalories({ kcal, basis, portion }: { kcal: number; basis: string; portion: string | null }) {
  return (
    <p className="m-0 flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <b className="num text-[44px] leading-none font-[650] tracking-[-0.045em] text-ink">{fmt(kcal)}</b>
      <span className="text-[14px] whitespace-nowrap text-subtle">kcal {basis}</span>
      {portion && <span className="num text-[14px] whitespace-nowrap text-subtle">· {portion}</span>}
    </p>
  );
}

/* ---------- calories and macros ---------- */

const MACROS: { key: "protein" | "carbs" | "fat"; label: string; icon: LucideIcon; text: string }[] = [
  { key: "protein", label: "Protein", icon: Drumstick, text: "text-protein" },
  { key: "carbs", label: "Carbs", icon: Wheat, text: "text-carbs" },
  { key: "fat", label: "Fat", icon: Droplet, text: "text-fat" },
];

/**
 * Protein, carbs and fat as three cards (mock-c1 "Food detail" C): the macro's icon in its colour, the
 * amount, and its share of the calories. No rings and no split bar: the share is the number.
 */
export function MacroCards({ n }: { n: Nutrients }) {
  const share = macroShare(n);
  return (
    <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0" aria-label="Macronutrients">
      {MACROS.map(({ key, label, icon: Icon, text }) => (
        <li key={key} className="grid min-w-0 gap-1 rounded-[20px] bg-surface px-3.5 py-3 shadow-card">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold whitespace-nowrap text-ink">
            <Icon className={cn("size-4 shrink-0", text)} aria-hidden />
            <span className="truncate">{label}</span>
          </span>
          <b className="num text-[24px] leading-none font-[650] tracking-[-0.03em] whitespace-nowrap text-ink">
            {grams(n[key])}<small className="ml-0.5 text-[14px] font-semibold"> g</small>
          </b>
          <small className="num truncate text-[12px] font-medium whitespace-nowrap text-subtle">{share[key]}% of kcal</small>
        </li>
      ))}
    </ul>
  );
}

const LEVEL_TONE: Record<Level, string | null> = { low: null, medium: "text-warn-ink", high: "text-bad" };
const LEVEL_WORD: Record<Level, string | null> = { low: null, medium: "Medium", high: "High" };

function NutrientCard({ row, foldable = false }: { row: NutrientRow; foldable?: boolean }) {
  const tone = row.level ? LEVEL_TONE[row.level] : null;
  const word = row.level ? LEVEL_WORD[row.level] : null;
  const dv = row.dv === null ? null : `${row.dv < 1 ? "<1" : row.dv}% DV`;
  return (
    <li className={cn("grid min-w-0 content-start gap-0.5 rounded-[16px] bg-surface px-3.5 py-3 shadow-card", foldable && "max-md:group-data-[folded=true]/fold:hidden")}>
      <span className="truncate text-[12.5px] font-medium whitespace-nowrap text-subtle">{row.label}</span>
      <b className={cn("num text-[17px] font-semibold tracking-[-0.02em] whitespace-nowrap", tone ?? "text-ink")}>
        {formatAmount(row.value)} <small className="text-[12.5px] font-medium">{row.unit}</small>
      </b>
      {(word || dv) && (
        <small className="num truncate text-[12px] whitespace-nowrap text-subtle">
          {word && <span className={cn("font-semibold", tone)}>{word}</span>}
          {word && dv && " · "}
          {dv}
        </small>
      )}
    </li>
  );
}

/**
 * A titled grid of small nutrient cards: "More nutrients" (limits banded per 100 g: medium in the
 * warn tone, high in the bad tone, each with its word so colour is never the only cue) and "Vitamins &
 * minerals" (with % of the Daily Value). Nothing at all when the food holds none of them. `foldAfter`:
 * on phones only the first that many show until "Show all {n}" (NutrientFold).
 */
export function NutrientGrid({ title, basis, rows, note, foldAfter }: { title: string; basis: string; rows: NutrientRow[]; note?: ReactNode; foldAfter?: number }) {
  if (rows.length === 0) return null;
  const fold = foldAfter !== undefined && rows.length > foldAfter;
  const list = (
    <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2 p-0">
      {rows.map((r, i) => <NutrientCard key={r.key} row={r} foldable={fold && i >= foldAfter!} />)}
    </ul>
  );
  return (
    <section className="grid gap-2" aria-label={title}>
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="section-title m-0">{title}</h2>
        <span className="text-[12.5px] whitespace-nowrap text-subtle">{basis}</span>
      </div>
      {fold ? <NutrientFold total={rows.length}>{list}</NutrientFold> : list}
      {note && <p className="m-0 px-1 text-[12.5px] text-subtle">{note}</p>}
    </section>
  );
}

/** Daily Values' source, under the vitamins grid. */
export const DV_NOTE = "% DV: share of a Daily Value for adults on 2,000 kcal (US FDA).";
/** Under the vitamins grid of an INDB food showing vitamin E (lib/foods/micros-map.ts microsFromINDB). */
export const INDB_VITAMIN_E_NOTE = "Vitamin E from INDB may include all tocopherols, so it can read high.";

/** The vitamins grid's note: the Daily Values' source, plus the INDB vitamin E caveat when it applies. */
export function vitaminsNote(fromIndb: boolean, n: Nutrients): string {
  return fromIndb && n.vitaminEMg !== undefined ? `${DV_NOTE} ${INDB_VITAMIN_E_NOTE}` : DV_NOTE;
}

/* ---------- better pick ---------- */

/** A healthier food in the same category (a link to it), else the engine's tip, else nothing. */
export function BetterPick({ alt, tip }: { alt: { id: string; name: string; grade: string | null } | undefined; tip?: string | null }) {
  if (alt) {
    return (
      <Link href={`/foods/${alt.id}`} className="flex min-h-11 items-center gap-3 rounded-[20px] bg-grade-a/10 p-3 transition-colors hover:bg-grade-a/15">
        <GradeBadge grade={alt.grade} size="md" />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[12px] font-semibold tracking-[0.06em] text-good-ink uppercase">Better pick</span>
          <span className="block truncate font-semibold text-ink">{alt.name}</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-subtle" aria-hidden />
      </Link>
    );
  }
  if (!tip) return null;
  return (
    <p className="m-0 flex items-start gap-3 rounded-[20px] bg-grade-a/10 p-3.5 text-[14px] leading-snug text-ink">
      <Lightbulb className="mt-px size-[18px] shrink-0 text-grade-a" aria-hidden />
      <span><b className="block text-[12px] font-semibold tracking-[0.06em] text-good-ink uppercase">Better pick</b>{tip}</span>
    </p>
  );
}

/* ---------- details ---------- */

/**
 * The sticky bottom action bar (mock-c1 `.actions`), fading the page out behind it. On wide screens
 * it spans the left column (the hero side of the two-column result) unless `fullWidth` (a one-column page).
 */
export function StickyActionBar({ children, fullWidth = false, className }: { children: ReactNode; fullWidth?: boolean; className?: string }) {
  return (
    <div data-sticky-actions className={cn(
      "sticky bottom-0 z-10 -mx-4 mt-1 bg-[linear-gradient(180deg,transparent,var(--bg)_30%)] px-[18px] pt-3 pb-[calc(22px+env(safe-area-inset-bottom))] md:mx-0 md:px-0 md:pb-5",
      !fullWidth && "lg:w-[calc((100%-16px)*0.525)]",
      className,
    )}>
      {children}
    </div>
  );
}
