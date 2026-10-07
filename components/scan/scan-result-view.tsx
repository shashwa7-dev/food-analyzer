// Server-rendered parts of /scans/[id] (spec §6.11, mock-c1 "Scan result"): tag chips, title, the
// grade hero, calories, macro rings, flag chips, the better pick and the details below; and the
// failure card. Data comes from the page (getScan, balance); nothing here touches the database.
import Link from "next/link";
import { Barcode, CheckCircle2, Info, RotateCcw, Scale, ScanLine, Sparkles, TriangleAlert } from "lucide-react";
import type { ScanView } from "@/lib/scans/service";
import { scanErrorAction } from "@/lib/scans/messages";
import { oneLineReason, packSize, typicalPortion } from "@/lib/scans/result-display";
import { foodIconKey, type FoodIconKey } from "@/lib/foods/icon";
import { GRADE_UNAVAILABLE } from "@/lib/nutrition/grade-unavailable";
import { moreNutrientRows, vitaminMineralRows } from "@/lib/nutrition/nutrient-display";
import { nutrientsFor } from "@/lib/nutrition/portions";
import type { Diet, Meal, Nutrients } from "@/lib/nutrition/types";
import type { ScanResult } from "@/lib/engine/result";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { FOOD_ICON, FoodIcon } from "@/components/food/food-icon";
import {
  BetterPick, CalorieRow, CARD, CATEGORY, FlagChips, fmt, GradeHero, MacroCards, NutrientGrid, ResultTitle, Tag, Tags, VerdictLine, vitaminsNote, WhyGrade,
} from "@/components/food/result-parts";
import { IndbSodiumNote } from "@/components/food/indb-sodium-note";
import { IngredientsUnknownNote } from "@/components/food/ingredients-unknown-note";
import { FullNutritionTable } from "@/components/food/nutrition-table";
import { cn } from "@/lib/utils";
import { MODE_META } from "./mode-meta";
import { PhotoHero } from "./photo-hero";
import { ResultActions, ResultTopBar } from "./scan-result";

/** Validated ?meal=&date= carried from /scan, passed on to "Scan again" links. */
export type ScanParams = { meal?: string; date?: string };

function scanQuery(sp: ScanParams, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams(extra);
  if (sp.meal) p.set("meal", sp.meal);
  if (sp.date) p.set("date", sp.date);
  return p.size ? `?${p}` : "";
}

/** The category chip's icon and word: from the name where it says something, else from the scan's kind. */
function category(r: ScanResult): FoodIconKey {
  if (r.kind === "meal") return "bowl";
  const byName = foodIconKey({ name: r.name, source: "scan" });
  return byName !== "default" ? byName : r.kind === "packaged" ? "package" : "default";
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

/**
 * A done scan's result (server-rendered); the top bar and the actions are the client parts. With stored
 * photos (photoUrls) it opens on the photo hero (mock-c1 "Food details (stored photo)"): the top bar on
 * the photo, the content on a sheet over its bottom edge (phone), left-aligned, and the one-line grade
 * in place of the grade card. Without photos, the grade-card layout.
 */
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
  const hasPhotos = view.photoUrls.length > 0;
  const align = hasPhotos ? "start" : "center";
  const reason = oneLineReason(r.reasons, r.grade);

  const content = (
    <>
      <Tags align={align}>
        {r.kind !== "meal" && <Tag icon={FOOD_ICON[iconKey]}>{CATEGORY[iconKey]}</Tag>}
        {pack && <Tag icon={Scale}><span className="num">{pack}</span></Tag>}
        <Tag icon={mode.icon}>{mode.label}</Tag>
      </Tags>
      <ResultTitle name={r.name} brand={r.brand} align={align} />

      <div className="grid gap-3 lg:grid-cols-[1.05fr_.95fr] lg:items-start lg:gap-4">
        <div className="flex min-w-0 flex-col gap-3">
          {hasPhotos
            ? <VerdictLine grade={r.grade} reason={reason} unavailable={r.gradeUnavailable} />
            : <GradeHero grade={r.grade} reason={reason} unavailable={r.gradeUnavailable} />}
          <CalorieRow kcal={shown.energyKcal} basis={basis} portion={portionText} />
          <MacroCards n={shown} />
          <FlagChips flags={r.flags} sodiumMg={shown.sodiumMg} sodiumPer100={r.per100?.sodiumMg} basis={r.basis} diet={diet} ingredientsKnown={r.ingredients.length > 0} />
          <BetterPick alt={r.alternatives[0]} tip={r.tip} />
          <NutrientGrid title="More nutrients" basis={basis} rows={moreNutrientRows(shown, r.per100, r.basis, r.components)} />
          <NutrientGrid title="Vitamins & minerals" basis={basis} rows={vitaminMineralRows(shown)} note={vitaminsNote(fromIndb, shown)} foldAfter={6} />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <WhyGrade reasons={r.reasons} hints={r.hints} goalFlags={goalFlags} />
          <IngredientsUnknownNote ingredientsKnown={r.ingredients.length > 0} hasAllergies={hasAllergies} />
          {r.kind === "meal" && r.items && r.items.length > 0 && <MealItems items={r.items} unit={unit} />}
          <section className={cn(CARD, "flex flex-col gap-2.5")}>
            <h2 className="section-title m-0">Ingredients</h2>
            {r.ingredients.length > 0
              ? <p className="m-0 text-sm leading-normal text-ink">{r.ingredients.join(", ")}</p>
              : <p className="m-0 text-sm text-subtle">No ingredient list was read.</p>}
            {fromIndb && <IndbSodiumNote source="indb" />}
            <FullNutritionTable
              per100={r.per100}
              portion={!r.per100 ? (p ? { label: p.label, grams: p.grams, nutrients: forPortion } : null) : typical || isMeal ? { label: p!.label, grams: p!.grams, nutrients: forPortion } : null}
              provenance={r.provenance}
              unit={unit}
            />
          </section>
          <SourceLine view={view} credits={credits} />
          <Button render={<Link href={`/scan${scanQuery(sp)}`} />} nativeButton={false} variant="ghost-sunken" shape="pill" size="lg" className="self-center">
            <ScanLine aria-hidden /> Scan something else
          </Button>
          <p className="m-0 px-1 text-[13px] text-subtle">Information only, not medical advice. Check the pack for allergens.</p>
        </div>
      </div>
    </>
  );

  return (
    <div data-no-phone-nav className="mx-auto flex w-full max-w-[1000px] flex-col gap-3">
      {hasPhotos ? (
        <>
          <PhotoHero urls={view.photoUrls}>
            <ResultTopBar scanId={view.id} title="Scan result" onMedia />
          </PhotoHero>
          {/* The sheet over the photo's bottom edge (mock-c1 `.sheet-body`), on a phone only. */}
          <div className="relative -mx-4 -mt-10 flex flex-col gap-3 rounded-t-[32px] bg-bg px-4 pt-2.5 md:mx-0 md:mt-1 md:rounded-none md:bg-transparent md:p-0">
            <span aria-hidden="true" className="mx-auto mb-1 block h-[5px] w-10 shrink-0 rounded-full bg-line md:hidden" />
            {content}
          </div>
        </>
      ) : (
        <>
          <ResultTopBar scanId={view.id} title="Scan result" />
          {content}
        </>
      )}

      <ResultActions
        scanId={view.id}
        food={{ name: r.name, per100: r.per100, perServing: r.perServing, portions: r.portions, defaultPortion: r.defaultPortion, basis: r.basis }}
        canSave={!!r.per100}
        date={date}
        defaultMeal={meal}
        isToday={isToday}
        iconKey={iconKey}
        grade={r.gradeUnavailable ? GRADE_UNAVAILABLE : r.grade}
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
