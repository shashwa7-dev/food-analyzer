// Server-rendered parts of /scans/[id]: the result (grade, reasons, nutrition, items, alternatives) and
// the failure card. Data comes from the page (getScan, balance); nothing here touches the database.
import Link from "next/link";
import { CheckCircle2, Info } from "lucide-react";
import type { ScanView } from "@/lib/scans/service";
import { scanErrorAction } from "@/lib/scans/messages";
import { nutrientsFor } from "@/lib/nutrition/portions";
import type { Meal } from "@/lib/nutrition/types";
import type { ScanResult } from "@/lib/engine/result";
import { GradeBadge, GradeStrip } from "@/components/grade-badge";
import { FlagList, ReasonList } from "@/components/food/food-verdict";
import { IndbSodiumNote } from "@/components/food/indb-sodium-note";
import { IngredientsUnknownNote } from "@/components/food/ingredients-unknown-note";
import { NutritionTable } from "@/components/food/nutrition-table";
import { AddScanToMeal, SaveScanToFoods } from "./scan-result";

/** Validated ?meal=&date= carried from /scan, passed on to "Scan again" links. */
export type ScanParams = { meal?: string; date?: string };

const CARD = "rounded-lg border border-line bg-surface p-5 shadow-card";
const LINK_BUTTON = "flex min-h-12 items-center justify-center rounded-lg px-4 font-semibold";

function scanQuery(sp: ScanParams, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams(extra);
  if (sp.meal) p.set("meal", sp.meal);
  if (sp.date) p.set("date", sp.date);
  return p.size ? `?${p}` : "";
}

export function FailedScan({ view, sp }: { view: ScanView; sp: ScanParams }) {
  const code = view.errorCode ?? "MODEL_ERROR";
  const action = scanErrorAction(code);
  const barcode = action?.kind === "photo" ? view.barcode : null;
  return (
    <div className="flex flex-col gap-4">
      <header>
        <div className="text-sm text-subtle">Scan result</div>
        <h1 className="title text-[30px] md:text-[34px]">{code === "BARCODE_NOT_FOUND" ? "Barcode not found" : "Scan failed"}</h1>
      </header>
      <section className={`${CARD} flex flex-col gap-4`}>
        <p role="alert">{view.errorMessage}</p>
        {barcode && action ? (
          <Link href={`/scan${scanQuery(sp, { barcode })}`} className={`${LINK_BUTTON} bg-accent text-accent-ink`}>{action.label}</Link>
        ) : action?.kind === "credits" ? (
          <Link href="/me/credits" className={`${LINK_BUTTON} bg-accent text-accent-ink`}>{action.label}</Link>
        ) : (
          <Link href={`/scan${scanQuery(sp)}`} className={`${LINK_BUTTON} bg-accent text-accent-ink`}>Scan again</Link>
        )}
      </section>
    </div>
  );
}

function Banner({ view, credits }: { view: ScanView & { result: ScanResult }; credits: number }) {
  const r = view.result;
  const photos = view.imageCount === 1 ? "1 photo" : `${view.imageCount} photos`;
  return (
    <div className="flex items-start gap-2.5 rounded-md bg-accent-soft px-3.5 py-3 text-sm">
      {r.confidence === "low" ? <Info className="mt-0.5 size-[18px] flex-none" aria-hidden /> : <CheckCircle2 className="mt-0.5 size-[18px] flex-none" aria-hidden />}
      <span>
        {view.charged ? (
          <>Read from {photos}. <b>Confidence: {r.confidence}.</b> 1 AI scan used, <span className="num">{credits}</span> left this month.</>
        ) : (
          <>Found by barcode. <b>Confidence: {r.confidence}.</b> Free barcode scan — no AI scan used.</>
        )}
      </span>
    </div>
  );
}

function MealItems({ items, unit }: { items: NonNullable<ScanResult["items"]>; unit: string }) {
  return (
    <section className={CARD}>
      <h2 className="section-title mb-2">On your plate</h2>
      <ul>
        {items.map((it, i) => (
          <li key={`${it.name}-${i}`} className="flex items-center justify-between gap-3 border-b border-line py-2.5 text-sm last:border-b-0">
            <span className="min-w-0">
              <span className="font-semibold">{it.name}</span>
              <span className="text-subtle"> · <span className="num">{Math.round(it.grams)} {unit}</span>{it.provenance === "estimate" && " · estimated"}</span>
            </span>
            <span className="num shrink-0">{Math.round(it.nutrients.energyKcal)} kcal</span>
          </li>
        ))}
      </ul>
    </section>
  );
}


/** A done scan's result (server-rendered); Add to meal and Save to my foods are the client parts. */
export function ScanResultView({ view, credits, fromIndb, date, meal, isToday, hasAllergies, sp }: {
  view: ScanView & { result: ScanResult }; credits: number; fromIndb: boolean;
  date: string; meal: Meal; isToday: boolean; hasAllergies: boolean; sp: ScanParams;
}) {
  const r = view.result;
  const unit = r.basis === "per_100ml" ? "ml" : "g";
  const p = r.portions[r.defaultPortion] ?? r.portions[0];
  const n = p?.grams ? nutrientsFor(r.per100, p.grams) : r.per100;
  return (
    <div className="flex flex-col gap-4">
      <header>
        <div className="text-sm text-subtle">Scan result</div>
        <h1 className="title text-[30px] md:text-[34px]">{r.name}</h1>
        {r.brand && <div className="text-sm text-subtle">{r.brand}</div>}
      </header>
      <Banner view={view} credits={credits} />
      <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr] lg:items-start">
        <div className="flex flex-col gap-4">
          <section className={`${CARD} flex flex-col gap-4`}>
            <div className="flex flex-wrap items-center justify-between gap-3.5">
              <GradeStrip grade={r.grade} />
              {r.gradeValue !== null && (
                <div className="text-right">
                  <div className="num text-[26px] font-bold">{r.gradeValue}<span className="text-sm text-subtle">/100</span></div>
                  <div className="text-sm text-subtle">Health score</div>
                </div>
              )}
            </div>
            <ReasonList reasons={r.reasons} />
          </section>
          <FlagList flags={r.flags} />
          {r.hints.map((h) => (
            <p key={h} className="flex items-start gap-1.5 rounded-md border border-line bg-surface p-3.5 text-sm">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />{h}
            </p>
          ))}
          <IngredientsUnknownNote ingredientsKnown={r.ingredients.length > 0} hasAllergies={hasAllergies} />
          {r.kind === "meal" && r.items && r.items.length > 0 && <MealItems items={r.items} unit={unit} />}
          <section className={CARD}>
            <AddScanToMeal scanId={view.id} food={{ name: r.name, per100: r.per100, portions: r.portions, defaultPortion: r.defaultPortion, basis: r.basis }} date={date} defaultMeal={meal} isToday={isToday} />
          </section>
        </div>
        <div className="flex flex-col gap-4">
          <section className={CARD}>
            <NutritionTable nutrients={n} provenance={r.provenance} portionLabel={p?.label ?? `100 ${unit}`} grams={p?.grams ?? null} unit={unit} />
            {r.ingredients.length > 0 && <p className="mt-2.5 text-sm text-subtle">Ingredients: {r.ingredients.join(", ")}</p>}
            {fromIndb && <div className="mt-2.5"><IndbSodiumNote source="indb" /></div>}
          </section>
          {r.alternatives.length > 0 ? (
            <section className={CARD}>
              <h2 className="section-title mb-2.5">Healthier options</h2>
              {r.alternatives.slice(0, 1).map((a) => (
                <Link key={a.id} href={`/foods/${a.id}`} className="flex min-h-11 items-center gap-3 rounded-md border border-line p-3">
                  <GradeBadge grade={a.grade} /><span className="font-semibold">{a.name}</span>
                </Link>
              ))}
            </section>
          ) : r.tip ? (
            <section className={CARD}>
              <h2 className="section-title mb-1.5">Healthier options</h2>
              <p className="text-sm">{r.tip}</p>
            </section>
          ) : null}
          <SaveScanToFoods scanId={view.id} />
          <Link href={`/scan${scanQuery(sp)}`} className={`${LINK_BUTTON} text-accent`}>Scan something else</Link>
        </div>
      </div>
      <p className="text-sm text-subtle">Information only, not medical advice. Check the pack for allergens.</p>
    </div>
  );
}
