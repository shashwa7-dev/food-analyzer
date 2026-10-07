// Server-rendered parts of /scans/[id] (spec §6.11, mock-c1 "Scan result"): tag chips, title, the
// grade hero, calories, macro rings, flag chips, the better pick and the details below; and the
// failure card. Data comes from the page (getScan, balance); nothing here touches the database.
import Link from "next/link";
import {
  Barcode, CheckCircle2, ChevronRight, Droplet, Droplets, Drumstick, Flame, Info, Leaf, Lightbulb,
  RotateCcw, Scale, ScanLine, Sparkles, TriangleAlert, Wheat, type LucideIcon,
} from "lucide-react";
import type { ScanView } from "@/lib/scans/service";
import { scanErrorAction } from "@/lib/scans/messages";
import { DIET_CHIP, macroShare, oneLineReason, packSize, sodiumLevel, typicalPortion, verdict } from "@/lib/scans/result-display";
import { foodIconKey, type FoodIconKey } from "@/lib/foods/icon";
import { nutrientsFor } from "@/lib/nutrition/portions";
import type { Diet, Flag, Grade, Meal, Nutrients } from "@/lib/nutrition/types";
import type { ScanResult } from "@/lib/engine/result";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { GradeBadge } from "@/components/grade-badge";
import { FOOD_ICON, FoodIcon } from "@/components/food/food-icon";
import { ReasonList } from "@/components/food/food-verdict";
import { FlagNotes } from "@/components/food/sheet-parts";
import { IndbSodiumNote } from "@/components/food/indb-sodium-note";
import { IngredientsUnknownNote } from "@/components/food/ingredients-unknown-note";
import { NutritionTable } from "@/components/food/nutrition-table";
import { cn } from "@/lib/utils";
import { MODE_META } from "./mode-meta";
import { ResultActions, ResultTopBar } from "./scan-result";

/** Validated ?meal=&date= carried from /scan, passed on to "Scan again" links. */
export type ScanParams = { meal?: string; date?: string };

const CARD = "rounded-[24px] bg-surface p-[18px] shadow-card";

function scanQuery(sp: ScanParams, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams(extra);
  if (sp.meal) p.set("meal", sp.meal);
  if (sp.date) p.set("date", sp.date);
  return p.size ? `?${p}` : "";
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");
/** Grams for a ring centre: one decimal under 10 g, whole grams above (the mock's "18.5g", "47g"). */
const grams = (n: number) => (n < 10 ? String(Math.round(n * 10) / 10) : String(Math.round(n)));

/* ---------- tags ---------- */

const CATEGORY: Record<FoodIconKey, string> = {
  package: "Packaged", drink: "Drink", bowl: "Dish", wheat: "Bread", milk: "Dairy", egg: "Egg", fruit: "Fruit", snack: "Snack", default: "Food",
};

/** The category chip's icon and word: from the name where it says something, else from the scan's kind. */
function category(r: ScanResult): FoodIconKey {
  if (r.kind === "meal") return "bowl";
  const byName = foodIconKey({ name: r.name, source: "scan" });
  return byName !== "default" ? byName : r.kind === "packaged" ? "package" : "default";
}

function Tag({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[11.5px] font-semibold tracking-[0.06em] whitespace-nowrap text-ink uppercase">
      <Icon className="size-3.5 text-subtle" aria-hidden />
      {children}
    </span>
  );
}

function Tags({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap justify-center gap-1.5">{children}</div>;
}

/* ---------- grade hero ---------- */

const HERO_BG: Record<Grade, string> = {
  A: "bg-grade-a/15", B: "bg-grade-b/15", C: "bg-grade-c/15", D: "bg-grade-d/15", E: "bg-grade-e/15",
};
const SCALE_BG: Record<Grade, string> = {
  A: "bg-grade-a", B: "bg-grade-b", C: "bg-grade-c", D: "bg-grade-d", E: "bg-grade-e",
};
const GRADES: Grade[] = ["A", "B", "C", "D", "E"];

function GradeHero({ grade, reason }: { grade: Grade | null; reason: string | null }) {
  return (
    <section className={cn("grid gap-3.5 rounded-[28px] p-[18px]", grade ? HERO_BG[grade] : "bg-sunken")} aria-label="Grade">
      <div className="flex items-center gap-3.5">
        <GradeBadge grade={grade} size="lg" />
        <p className="m-0 min-w-0 text-[14px] leading-[1.35] text-ink">
          <b className="mb-0.5 block text-[16px] font-semibold">{verdict(grade)}</b>
          {reason}
        </p>
      </div>
      {grade && (
        <div className="grid grid-cols-5 gap-1" aria-hidden>
          {GRADES.map((g) => (
            <span
              key={g}
              className={cn(
                "grid h-[26px] place-items-center rounded-[8px] text-[12px] font-bold",
                SCALE_BG[g],
                g === grade ? "scale-y-[1.18] text-on-media ring-2 ring-surface" : "text-on-media-ink/55",
                g === grade && g === "C" && "text-on-media-ink",
              )}
            >
              {g}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------- calories and macros ---------- */

function CalorieRow({ kcal, basis, portion }: { kcal: number; basis: string; portion: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[20px] bg-brand-soft py-3 pr-3.5 pl-[18px]">
      <span className="num inline-flex min-w-0 items-baseline gap-1 text-[16px] font-semibold whitespace-nowrap text-ink">
        <Flame className="size-[18px] shrink-0 self-center text-brand-deep" aria-hidden />
        {fmt(kcal)} kcal <small className="text-[13px] font-medium text-subtle">{basis}</small>
      </span>
      {portion && <span className="num truncate text-[13px] text-subtle">{portion}</span>}
    </div>
  );
}

const MACROS: { key: "protein" | "carbs" | "fat"; label: string; icon: LucideIcon; text: string }[] = [
  { key: "protein", label: "Protein", icon: Drumstick, text: "text-protein" },
  { key: "carbs", label: "Carbs", icon: Wheat, text: "text-carbs" },
  { key: "fat", label: "Fat", icon: Droplet, text: "text-fat" },
];

function MacroRings({ n }: { n: Nutrients }) {
  const share = macroShare(n);
  return (
    <div className="grid grid-cols-3 gap-2">
      {MACROS.map(({ key, label, icon: Icon, text }) => (
        <div key={key} className={cn(CARD, "grid justify-items-center gap-1.5 px-1.5 py-3 text-[13px] font-medium")}>
          <span className="inline-flex items-center gap-1 whitespace-nowrap text-ink">
            <Icon className={cn("size-4", text)} aria-hidden />
            {label}
          </span>
          <div className={cn("relative size-[66px]", text)}>
            <svg viewBox="0 0 66 66" className="size-full -rotate-90" aria-hidden>
              <circle cx="33" cy="33" r="27" fill="none" stroke="currentColor" strokeOpacity=".16" strokeWidth="7" />
              {share[key] > 0 && (
                <circle cx="33" cy="33" r="27" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" pathLength={100} strokeDasharray={`${share[key]} 100`} />
              )}
            </svg>
            <b className="num absolute inset-0 grid place-items-center text-[15px] tracking-[-0.02em] text-ink">{grams(n[key])}g</b>
          </div>
          <small className="num text-[11px] font-medium whitespace-nowrap text-subtle">{share[key]}% of kcal</small>
        </div>
      ))}
    </div>
  );
}

/* ---------- flags ---------- */

function FlagChip({ icon: Icon, tone, title, children }: { icon: LucideIcon; tone: string; title?: string; children: React.ReactNode }) {
  return (
    <span title={title} className="inline-flex items-center gap-1.5 rounded-[12px] bg-sunken px-[11px] py-[7px] text-[13px] font-medium whitespace-nowrap text-ink">
      <Icon className={cn("size-4 shrink-0", tone)} aria-hidden />
      {children}
    </span>
  );
}

const SODIUM_TONE = { low: "text-ok", medium: "text-warn", high: "text-bad" } as const;

/** Allergen and diet flags (the personal ones from M1), sodium, and the diet fit, as short icon chips. */
function FlagChips({ flags, sodiumMg, sodiumPer100, diet }: { flags: Flag[]; sodiumMg: number | undefined; sodiumPer100: number | undefined; diet: Diet }) {
  const allergens = flags.filter((f) => f.type === "allergen");
  const dietFlag = flags.find((f) => f.type === "diet");
  const chips = [
    ...allergens.map((f) => (
      <FlagChip key={f.key} icon={TriangleAlert} tone="text-bad" title={f.text}>
        {f.severity === "may_contain" ? "May contain" : "Contains"} {f.key.replace("_", " ")}
      </FlagChip>
    )),
    sodiumMg !== undefined && (
      <FlagChip key="sodium" icon={Droplets} tone={SODIUM_TONE[sodiumLevel(sodiumPer100 ?? sodiumMg)]}>
        <span className="num">Sodium {fmt(sodiumMg)} mg</span>
      </FlagChip>
    ),
    dietFlag ? (
      <FlagChip key="diet" icon={Leaf} tone="text-bad" title={dietFlag.text}>Not {DIET_CHIP[dietFlag.key as Exclude<Diet, "none">] ?? dietFlag.key}</FlagChip>
    ) : diet !== "none" ? (
      <FlagChip key="diet" icon={Leaf} tone="text-ok">{DIET_CHIP[diet]}</FlagChip>
    ) : null,
  ].filter(Boolean);
  if (chips.length === 0) return null;
  return <div className="flex flex-wrap gap-1.5" aria-label="Flags" role="list">{chips.map((c, i) => <span role="listitem" key={i} className="contents">{c}</span>)}</div>;
}

/* ---------- better pick ---------- */

function BetterPick({ r }: { r: ScanResult }) {
  const alt = r.alternatives[0];
  if (alt) {
    return (
      <Link href={`/foods/${alt.id}`} className="flex min-h-11 items-center gap-3 rounded-[20px] bg-grade-a/10 p-3 transition-colors hover:bg-grade-a/15">
        <GradeBadge grade={alt.grade} size="md" />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[12px] font-semibold tracking-[0.06em] text-subtle uppercase">Better pick</span>
          <span className="block truncate font-semibold text-ink">{alt.name}</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-subtle" aria-hidden />
      </Link>
    );
  }
  if (!r.tip) return null;
  return (
    <p className="m-0 flex items-start gap-3 rounded-[20px] bg-grade-a/10 p-3.5 text-[14px] leading-snug text-ink">
      <Lightbulb className="mt-px size-[18px] shrink-0 text-grade-a" aria-hidden />
      <span><b className="block text-[12px] font-semibold tracking-[0.06em] text-subtle uppercase">Better pick</b>{r.tip}</span>
    </p>
  );
}

/* ---------- details ---------- */

function MealItems({ items, unit }: { items: NonNullable<ScanResult["items"]>; unit: string }) {
  return (
    <section className={CARD}>
      <h2 className="section-title mb-1">On your plate</h2>
      <ul className="m-0 list-none p-0">
        {items.map((it, i) => (
          <li key={`${it.name}-${i}`} className="flex items-center gap-3 border-b border-line py-2.5 text-sm last:border-b-0">
            <FoodIcon iconKey={foodIconKey({ name: it.name, source: "scan" })} size="sm" />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate font-semibold">{it.name}</span>
              <span className="text-subtle"><span className="num">{Math.round(it.grams)} {unit}</span>{it.provenance === "estimate" && " · estimated"}</span>
            </span>
            <span className="num shrink-0 font-semibold">{fmt(it.nutrients.energyKcal)} kcal</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SourceLine({ view, credits }: { view: ScanView & { result: ScanResult }; credits: number }) {
  const r = view.result;
  const photos = view.imageCount === 1 ? "1 photo" : `${view.imageCount} photos`;
  const Icon = r.confidence === "low" ? Info : CheckCircle2;
  return (
    <p className="m-0 flex items-start gap-2 px-1 text-[13px] leading-snug text-subtle">
      <Icon className="mt-px size-4 shrink-0" aria-hidden />
      <span>
        {view.charged ? (
          <>Read from {photos}. Confidence: {r.confidence}. 1 AI scan used, <span className="num">{credits}</span> left this month.</>
        ) : (
          <>Found by barcode. Confidence: {r.confidence}. Free barcode scan, no AI scan used.</>
        )}
      </span>
    </p>
  );
}

/** A done scan's result (server-rendered); the top bar and the actions are the client parts. */
export function ScanResultView({ view, credits, fromIndb, date, meal, isToday, hasAllergies, diet, sp }: {
  view: ScanView & { result: ScanResult }; credits: number; fromIndb: boolean;
  date: string; meal: Meal; isToday: boolean; hasAllergies: boolean; diet: Diet; sp: ScanParams;
}) {
  const r = view.result;
  const unit = r.basis === "per_100ml" ? "ml" : "g";
  const p = r.portions[r.defaultPortion] ?? r.portions[0];
  // No per-100 values (per-serving label, weight unknown): show the one serving as printed.
  const forPortion = r.per100 ? (p?.grams ? nutrientsFor(r.per100, p.grams) : r.per100) : (r.perServing ?? { energyKcal: 0, protein: 0, carbs: 0, fat: 0 });
  // The hero numbers: per 100 for a product, the whole plate for a meal, the serving when that's all there is.
  const isMeal = r.kind === "meal" && !!p?.grams;
  const shown: Nutrients = isMeal || !r.per100 ? forPortion : r.per100;
  const basis = isMeal ? "this meal" : r.per100 ? `per 100 ${unit}` : "per serving";
  const typical = r.per100 ? typicalPortion(r.portions, r.defaultPortion) : null;
  const portionText = isMeal
    ? `${fmt(p!.grams!)} ${unit}`
    : typical && r.per100
      ? `${fmt(typical.grams!)} ${unit} = ${fmt((r.per100.energyKcal * typical.grams!) / 100)} kcal`
      : null;
  const iconKey = category(r);
  const pack = packSize(r.portions, unit);
  const mode = MODE_META[r.inputKind];
  const goalFlags = r.flags.filter((f) => f.type === "goal");

  return (
    <div data-no-phone-nav className="mx-auto flex w-full max-w-[1000px] flex-col gap-3">
      <ResultTopBar scanId={view.id} title="Scan result" />
      <Tags>
        {r.kind !== "meal" && <Tag icon={FOOD_ICON[iconKey]}>{CATEGORY[iconKey]}</Tag>}
        {pack && <Tag icon={Scale}><span className="num">{pack}</span></Tag>}
        <Tag icon={mode.icon}>{mode.label}</Tag>
      </Tags>
      <header className="text-center">
        <h1 className="title m-0 text-[30px] leading-[1.05] font-[650] tracking-[-0.04em] text-ink">{r.name}</h1>
        {r.brand && <p className="m-0 mt-1 text-[13px] text-subtle">{r.brand}</p>}
      </header>

      <div className="grid gap-3 lg:grid-cols-[1.05fr_.95fr] lg:items-start lg:gap-4">
        <div className="flex min-w-0 flex-col gap-3">
          <GradeHero grade={r.grade} reason={oneLineReason(r.reasons)} />
          <CalorieRow kcal={shown.energyKcal} basis={basis} portion={portionText} />
          <MacroRings n={shown} />
          <FlagChips flags={r.flags} sodiumMg={shown.sodiumMg} sodiumPer100={r.per100?.sodiumMg} diet={diet} />
          <BetterPick r={r} />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          {(r.reasons.length > 0 || r.hints.length > 0 || goalFlags.length > 0) && (
            <section className={cn(CARD, "flex flex-col gap-3")}>
              <h2 className="section-title m-0">Why this grade</h2>
              <ReasonList reasons={r.reasons} />
              {r.hints.map((h) => (
                <p key={h} className="m-0 flex items-start gap-2 text-sm text-subtle">
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden />{h}
                </p>
              ))}
              <FlagNotes flags={goalFlags} />
            </section>
          )}
          <IngredientsUnknownNote ingredientsKnown={r.ingredients.length > 0} hasAllergies={hasAllergies} />
          {r.kind === "meal" && r.items && r.items.length > 0 && <MealItems items={r.items} unit={unit} />}
          <section className={CARD}>
            <NutritionTable nutrients={forPortion} provenance={r.provenance} portionLabel={p?.label ?? `100 ${unit}`} grams={p?.grams ?? null} unit={unit} />
            {r.ingredients.length > 0 && <p className="mt-2.5 mb-0 text-sm text-subtle">Ingredients: {r.ingredients.join(", ")}</p>}
            {fromIndb && <div className="mt-2.5"><IndbSodiumNote source="indb" /></div>}
          </section>
          <SourceLine view={view} credits={credits} />
          <Button render={<Link href={`/scan${scanQuery(sp)}`} />} nativeButton={false} variant="ghost-sunken" shape="pill" size="lg" className="self-center">
            <ScanLine aria-hidden /> Scan something else
          </Button>
          <p className="m-0 px-1 text-[13px] text-subtle">Information only, not medical advice. Check the pack for allergens.</p>
        </div>
      </div>

      <ResultActions
        scanId={view.id}
        food={{ name: r.name, per100: r.per100, perServing: r.perServing, portions: r.portions, defaultPortion: r.defaultPortion, basis: r.basis }}
        canSave={!!r.per100}
        date={date}
        defaultMeal={meal}
        isToday={isToday}
        iconKey={iconKey}
        grade={r.grade}
        subtitle={[r.brand, `${mode.label} scan`].filter(Boolean).join(" · ")}
        flags={r.flags}
      />
    </div>
  );
}

/** A failed scan, in the same card style: the M2 sentence and its one recovery action. */
export function FailedScan({ view, sp }: { view: ScanView; sp: ScanParams }) {
  const code = view.errorCode ?? "MODEL_ERROR";
  const action = scanErrorAction(code);
  const barcode = action?.kind === "photo" ? view.barcode : null;
  const notFound = code === "BARCODE_NOT_FOUND";
  const mode = view.inputKind ? MODE_META[view.inputKind] : null;
  const href = barcode && action
    ? `/scan${scanQuery(sp, { barcode, mode: "label" })}`
    : action?.kind === "credits"
      ? "/me/credits"
      : `/scan${scanQuery(sp)}`;
  const label = barcode && action ? action.label : action?.kind === "credits" ? action.label : "Scan again";
  const ActionIcon = action?.kind === "credits" ? Sparkles : barcode ? ScanLine : RotateCcw;
  return (
    <div data-no-phone-nav className="mx-auto flex w-full max-w-[560px] flex-col gap-3">
      <ResultTopBar scanId={view.id} title="Scan result" />
      {mode && <Tags><Tag icon={mode.icon}>{mode.label}</Tag></Tags>}
      <section className="grid gap-4 rounded-[28px] bg-surface p-5 shadow-card">
        <div className="flex items-center gap-3.5">
          <IconTile tone="bad" size="lg">{notFound ? <Barcode /> : <TriangleAlert />}</IconTile>
          <h1 className="title m-0 text-[24px] font-[650] tracking-[-0.03em] text-ink">{notFound ? "Barcode not found" : "Scan failed"}</h1>
        </div>
        <p role="alert" className="m-0 text-[15px] leading-normal text-ink">{view.errorMessage}</p>
        <Button render={<Link href={href} />} nativeButton={false} shape="pill" size="xl" className="h-[54px] w-full">
          <ActionIcon aria-hidden /> {label}
        </Button>
      </section>
    </div>
  );
}
