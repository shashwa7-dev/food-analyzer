import type { TargetProgress } from "@/lib/nutrition/totals";

export type Tone = "ok" | "over";

/** "over" once eaten passes the target (exactly on target is still "ok"); drives the red over-target signal. */
export function toneFor(eaten: number, target: number): Tone {
  return target > 0 && eaten > target ? "over" : "ok";
}

export type LimitKey = "sugarsMax" | "sodiumMgMax" | "satFatMax";
/** "partial": under 90% on the known entries, but some entries have no value, so it can't be called ok. */
export type LimitTone = "ok" | "near" | "over" | "partial";
/**
 * One daily limit for the Daily limits card: eaten (`total`), the limit (`target`) and its share
 * (`ratio`). `unknown` entries have no value for it, so `total` is a floor ("300+").
 */
export type LimitRow = { key: LimitKey; label: string; total: number; target: number; unit: "g" | "mg"; ratio: number; tone: LimitTone; unknown: number };
export type LimitChip = LimitRow & { tone: "near" | "over" };

// The Daily limits card's row order (mock-c1 "Today on desktop", option A).
const LIMITS: { key: LimitKey; label: string; unit: "g" | "mg" }[] = [
  { key: "sodiumMgMax", label: "Sodium", unit: "mg" },
  { key: "satFatMax", label: "Sat fat", unit: "g" },
  { key: "sugarsMax", label: "Sugar", unit: "g" },
];

/** The NEAR_LIMIT share of a limit at which it counts as close. */
export const NEAR_LIMIT = 0.9;

const limitTone = (ratio: number): "ok" | "near" | "over" => (ratio > 1 ? "over" : ratio >= NEAR_LIMIT ? "near" : "ok");

/**
 * The three daily limits (sodium, saturated fat, sugar) in card order: "over" above 100% of the
 * limit, "near" from 90%, else "ok" — or "partial" when some entries have no value for it (a known
 * total that is already near or over still says so). A limit without a target is left out. Fibre is a
 * goal, not a limit, so it never appears.
 */
export function limitRows(progress: TargetProgress[]): LimitRow[] {
  const rows: LimitRow[] = [];
  for (const { key, label, unit } of LIMITS) {
    const p = progress.find((x) => x.key === key);
    if (!p || p.target <= 0) continue;
    const ratio = p.total / p.target;
    const known = limitTone(ratio);
    rows.push({ key, label, total: p.total, target: p.target, unit, ratio, tone: known === "ok" && p.unknown > 0 ? "partial" : known, unknown: p.unknown });
  }
  return rows;
}

/** The limits at 90% or more (near or over), worst first. */
export function flaggedLimits(rows: LimitRow[]): LimitChip[] {
  return rows.filter((r): r is LimitChip => r.tone === "near" || r.tone === "over").sort((a, b) => b.ratio - a.ratio);
}

const grouped = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 1 });

/**
 * "{eaten} / {limit}" as whole numbers, except when rounding would show a different tone than the
 * real one (22.3 g of a 22 g limit is over but reads "22 / 22"; 44.9 g of 50 g is under 90% but
 * reads "45 / 50"): then the eaten amount keeps one decimal. `partial` (some entries unknown) marks
 * the eaten amount as a floor: "300+ / 2,000".
 */
export function limitAmount(total: number, target: number, partial = false): string {
  const t = Math.round(target);
  const whole = Math.round(total);
  const misleading = t > 0 && limitTone(whole / t) !== limitTone(total / target);
  return `${grouped(misleading ? Math.round(total * 10) / 10 : whole)}${partial ? "+" : ""} / ${grouped(t)}`;
}

export type LimitsSummary = {
  /** "1 close" (warn) or "2 over" (bad, wins over close); null when every limit is under 90%. */
  badge: { tone: "near" | "over"; count: number; text: string } | null;
  /**
   * One factual line naming the worst limit, e.g. "Sodium is over your 2,000 mg limit."; with none
   * flagged but some unknown, a line saying those totals may be higher; null when all are fine.
   */
  tip: string | null;
};

export function limitsSummary(rows: LimitRow[]): LimitsSummary {
  const flagged = flaggedLimits(rows);
  const worst = flagged[0];
  if (!worst) {
    const partial = rows.filter((r) => r.unknown > 0).map((r) => r.label.toLowerCase());
    if (!partial.length) return { badge: null, tip: null };
    return { badge: null, tip: `Some items have no ${partial.join(" or ")} value, so ${partial.length === 1 ? "that total" : "those totals"} may be higher.` };
  }
  const over = flagged.filter((r) => r.tone === "over").length;
  const badge = over > 0
    ? { tone: "over" as const, count: over, text: `${over} over` }
    : { tone: "near" as const, count: flagged.length, text: `${flagged.length} close` };
  const where = worst.tone === "over" ? "over" : "close to";
  return { badge, tip: `${worst.label} is ${where} your ${grouped(Math.round(worst.target))} ${worst.unit} limit.` };
}

/** "1 item unknown" / "3 items unknown". */
export const unknownNote = (n: number) => `${n} ${n === 1 ? "item" : "items"} unknown`;
