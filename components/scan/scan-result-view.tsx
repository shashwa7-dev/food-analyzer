// Server-rendered parts of /scans/[id] (spec §6.11): the result, on the food page's layout with a
// small image tile beside the title; and the failure card. Data comes from the page (getScan, balance); nothing here touches the database.
import Link from "next/link";
import { cn } from "@/lib/utils";
import { GradeBadge } from "@/components/grade-badge";
import { Barcode, CheckCircle2, Info, RotateCcw, ScanLine, Sparkles, TriangleAlert } from "lucide-react";
import type { ScanView } from "@/lib/scans/service";
import { scanErrorAction } from "@/lib/scans/messages";
import { dietChip, oneLineReason, packSize, typicalPortion, verdict, warningFlags } from "@/lib/scans/result-display";
import { foodIconKey, type FoodIconKey } from "@/lib/foods/icon";
import { GRADE_UNAVAILABLE } from "@/lib/nutrition/grade-unavailable";
import { moreNutrientRows, vitaminMineralRows } from "@/lib/nutrition/nutrient-display";
import { nutrientsFor } from "@/lib/nutrition/portions";
import type { Diet, Meal, Nutrients } from "@/lib/nutrition/types";
import type { ScanResult } from "@/lib/engine/result";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { FoodIcon } from "@/components/food/food-icon";
import {
  BetterPick, BigCalories, CARD, CATEGORY, DietChip, fmt, MacroCards, NutrientGrid, Tag, Tags, vitaminsNote,
} from "@/components/food/result-parts";
import { DetailTabs } from "@/components/food/detail-tabs";
import { ReasonList } from "@/components/food/food-verdict";
import { IndbSodiumNote } from "@/components/food/indb-sodium-note";
import { IngredientsUnknownNote } from "@/components/food/ingredients-unknown-note";
import { FullNutritionTable } from "@/components/food/nutrition-table";
import { FlagNotes } from "@/components/food/sheet-parts";
import { MODE_META } from "./mode-meta";
import { ResultActions, ResultTopBar, ScanAddPanel } from "./scan-result";
import { ScanImageTile } from "./scan-image-tile";

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
 * A done scan's result (server-rendered), laid out like a food's page (/foods/[id]): a title row with
 * the image tile, the one-line verdict, calories, macros, nutrient cards and tabs on the left; the
 * add panel and source line in a sticky column from `md`. Phones stack, with
 * the sticky "Add to {Meal}" bar. The top bar and the actions are the client parts.
 */
export function ScanResultView({ view, credits, fromIndb, date, meal, isToday, hasAllergies, diet }: {
  view: ScanView & { result: ScanResult }; credits: number; fromIndb: boolean;
  date: string; meal: Meal; isToday: boolean; hasAllergies: boolean; diet: Diet;
}) {
  const r = view.result;
  const unit = r.basis === "per_100ml" ? "ml" : "g";
  const p = r.portions[r.defaultPortion] ?? r.portions[0];
  // No per-100 values (per-serving label, weight unknown): show the one serving as printed.
  const forPortion = r.per100 ? (p?.grams ? nutrientsFor(r.per100, p.grams) : r.per100) : (r.perServing ?? { energyKcal: 0, protein: 0, carbs: 0, fat: 0 });
  // The headline numbers: per 100 for a product, the whole plate for a meal, the serving when that's all there is.
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
  const mode = MODE_META[r.inputKind];
  const goalFlags = r.flags.filter((f) => f.type === "goal");
  const ingredientsKnown = r.ingredients.length > 0;
  // "Amul · Packaged · 200 g pack · Label scan · per 100 g"
  const kindWord = r.kind === "meal" || iconKey === "default" ? null : CATEGORY[iconKey];
  const meta = [r.brand, kindWord, packSize(r.portions, unit), `${mode.label} scan`, basis].filter(Boolean).join(" · ");
  const grade = r.gradeUnavailable ? null : r.grade;
  const whyLabel = r.gradeUnavailable || !grade ? "Why no grade" : `Why ${grade}`;
  const food = { name: r.name, per100: r.per100, perServing: r.perServing, portions: r.portions, defaultPortion: r.defaultPortion, basis: r.basis };
  const canSave = !!r.per100;
  const better = <BetterPick alt={r.alternatives[0]} tip={r.tip} />;
  const longName = r.name.length > 40;
  const chip = dietChip(diet, r.flags, ingredientsKnown) !== null;
  const hasBetter = !!r.alternatives[0] || !!r.tip;
  const source = <SourceLine view={view} credits={credits} />;

  const why = (
    <div className="flex flex-col gap-3 text-[14px]">
      <ReasonList reasons={r.reasons} />
      {r.hints.map((h) => (
        <p key={h} className="m-0 flex items-start gap-2 text-subtle"><Info className="mt-0.5 size-4 shrink-0" aria-hidden />{h}</p>
      ))}
      <FlagNotes flags={goalFlags} />
    </div>
  );
  const ingredients = (
    <div className="flex flex-col gap-3 text-[14px]">
      {ingredientsKnown
        ? <p className="m-0 leading-normal text-ink">{r.ingredients.join(", ")}</p>
        : <p className="m-0 text-subtle">No ingredient list was read.</p>}
      {fromIndb && <IndbSodiumNote source="indb" />}
      <FullNutritionTable
        per100={r.per100}
        portion={!r.per100 ? (p ? { label: p.label, grams: p.grams, nutrients: forPortion } : null) : typical || isMeal ? { label: p!.label, grams: p!.grams, nutrients: forPortion } : null}
        provenance={r.provenance}
        unit={unit}
      />
    </div>
  );
  const tabs = [
    { id: "why", label: whyLabel, panel: why },
    { id: "ingredients", label: "Ingredients", panel: ingredients },
    ...(r.kind === "meal" && r.items && r.items.length > 0 ? [{ id: "items", label: "Items", panel: <MealItems items={r.items} unit={unit} /> }] : []),
  ];

  return (
    <div data-no-phone-nav className="mx-auto flex w-full max-w-[1040px] flex-col gap-4">
      <ResultTopBar scanId={view.id} title="Scan result" />

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px] md:items-start md:gap-6">
        <div className="flex min-w-0 flex-col gap-4">
          {/* One plain block (no card): the image with the grade pinned to its corner, then the name, meta and one-line verdict; the diet chip sits top right. */}
          <section data-scan-title aria-label="Result" className="relative flex items-start gap-5">
            <div className="relative shrink-0">
              <ScanImageTile src={view.imageUrl} name={r.name} iconKey={iconKey} />
              {/* White ring in both themes: the badge sits on a photo or the tinted tile, like a sticker. */}
              <span className="absolute -right-1.5 -bottom-1.5 rounded-[12px] ring-[3px] ring-on-media">
                <GradeBadge grade={r.gradeUnavailable ? GRADE_UNAVAILABLE : grade} size="base" />
              </span>
            </div>
            {/* The copy starts level with the image's top edge, with one even step between its three lines. */}
            <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
              <h1
                title={longName ? r.name : undefined}
                className={cn(
                  "title m-0 line-clamp-3 leading-[1.1] font-[650] tracking-[-0.035em] break-words text-ink",
                  longName ? "text-[22px] md:text-[24px]" : "text-[26px] md:text-[30px]",
                  chip && "pr-[88px]", // room for the diet chip
                )}
              >
                {r.name}
              </h1>
              <p className="m-0 line-clamp-2 text-[13px] leading-[1.4] text-subtle">{meta}</p>
              <p className="m-0 text-[13.5px] leading-[1.4] text-subtle">
                <b className="font-semibold text-ink">{r.gradeUnavailable ? "Grade unavailable" : verdict(grade)}</b>
                {(r.gradeUnavailable ?? oneLineReason(r.reasons, r.grade)) && <> · {r.gradeUnavailable ?? oneLineReason(r.reasons, r.grade)}</>}
              </p>
            </div>
            {chip && <span className="absolute top-0 right-0"><DietChip diet={diet} flags={r.flags} ingredientsKnown={ingredientsKnown} /></span>}
          </section>
          <FlagNotes flags={warningFlags(r.flags)} />
          <IngredientsUnknownNote ingredientsKnown={ingredientsKnown} hasAllergies={hasAllergies} />
          <BigCalories kcal={shown.energyKcal} basis={basis} portion={portionText} />
          <MacroCards n={shown} />
          {hasBetter && <div className="md:hidden">{better}</div>}
          <NutrientGrid title="More nutrients" basis={basis} rows={moreNutrientRows(shown, r.per100, r.basis, r.components)} />
          <NutrientGrid title="Vitamins & minerals" basis={basis} rows={vitaminMineralRows(shown)} note={vitaminsNote(fromIndb, shown)} foldAfter={6} />
          <DetailTabs label="Details" tabs={tabs} />
          <p className="m-0 px-1 text-[13px] text-subtle">Information only, not medical advice. Check the pack for allergens.</p>
          <div className="md:hidden">{source}</div>
        </div>

        <aside className="hidden min-w-0 flex-col gap-3 md:sticky md:top-4 md:flex">
          <ScanAddPanel
            scanId={view.id}
            food={food}
            canSave={canSave}
            date={date}
            defaultMeal={meal}
            isToday={isToday}
            footer={better}
          />
          {source}
        </aside>
      </div>

      <ResultActions
        scanId={view.id}
        food={food}
        canSave={canSave}
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
