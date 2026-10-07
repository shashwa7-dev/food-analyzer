import type { TargetProgress } from "@/lib/nutrition/totals";

export type Tone = "ok" | "over";

/** "over" once eaten passes the target (exactly on target is still "ok"); drives the red over-target signal. */
export function toneFor(eaten: number, target: number): Tone {
  return target > 0 && eaten > target ? "over" : "ok";
}

export type LimitKey = "sugarsMax" | "sodiumMgMax" | "satFatMax";
export type LimitTone = "ok" | "near" | "over";
/** One daily limit for the Daily limits card: eaten (`total`), the limit (`target`) and its share (`ratio`). */
export type LimitRow = { key: LimitKey; label: string; total: number; target: number; unit: "g" | "mg"; ratio: number; tone: LimitTone };
export type LimitChip = LimitRow & { tone: "near" | "over" };

// The Daily limits card's row order (mock-c1 "Today on desktop", option A).
const LIMITS: { key: LimitKey; label: string; unit: "g" | "mg" }[] = [
  { key: "sodiumMgMax", label: "Sodium", unit: "mg" },
  { key: "satFatMax", label: "Sat fat", unit: "g" },
  { key: "sugarsMax", label: "Sugar", unit: "g" },
];

/** The NEAR_LIMIT share of a limit at which it counts as close. */
export const NEAR_LIMIT = 0.9;

const limitTone = (ratio: number): LimitTone => (ratio > 1 ? "over" : ratio >= NEAR_LIMIT ? "near" : "ok");

/**
 * The three daily limits (sodium, saturated fat, sugar) in card order: "over" above 100% of the
 * limit, "near" from 90%, else "ok". A limit without a target is left out. Fibre is a goal, not a
 * limit, so it never appears.
 */
export function limitRows(progress: TargetProgress[]): LimitRow[] {
  const rows: LimitRow[] = [];
  for (const { key, label, unit } of LIMITS) {
    const p = progress.find((x) => x.key === key);
    if (!p || p.target <= 0) continue;
    const ratio = p.total / p.target;
    rows.push({ key, label, total: p.total, target: p.target, unit, ratio, tone: limitTone(ratio) });
  }
  return rows;
}

/** The limits at 90% or more (near or over), worst first. */
export function flaggedLimits(rows: LimitRow[]): LimitChip[] {
  return rows.filter((r): r is LimitChip => r.tone !== "ok").sort((a, b) => b.ratio - a.ratio);
}

const grouped = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 1 });

/**
 * "{eaten} / {limit}" as whole numbers, except when rounding would show a different tone than the
 * real one (22.3 g of a 22 g limit is over but reads "22 / 22"; 44.9 g of 50 g is under 90% but
 * reads "45 / 50"): then the eaten amount keeps one decimal.
 */
export function limitAmount(total: number, target: number): string {
  const t = Math.round(target);
  const whole = Math.round(total);
  const misleading = t > 0 && limitTone(whole / t) !== limitTone(total / target);
  return `${grouped(misleading ? Math.round(total * 10) / 10 : whole)} / ${grouped(t)}`;
}

export type LimitsSummary = {
  /** "1 close" (warn) or "2 over" (bad, wins over close); null when every limit is under 90%. */
  badge: { tone: "near" | "over"; count: number; text: string } | null;
  /** One factual line naming the worst limit, e.g. "Sodium is over your 2,000 mg limit."; null when all are fine. */
  tip: string | null;
};

export function limitsSummary(rows: LimitRow[]): LimitsSummary {
  const flagged = flaggedLimits(rows);
  const worst = flagged[0];
  if (!worst) return { badge: null, tip: null };
  const over = flagged.filter((r) => r.tone === "over").length;
  const badge = over > 0
    ? { tone: "over" as const, count: over, text: `${over} over` }
    : { tone: "near" as const, count: flagged.length, text: `${flagged.length} close` };
  const where = worst.tone === "over" ? "over" : "close to";
  return { badge, tip: `${worst.label} is ${where} your ${grouped(Math.round(worst.target))} ${worst.unit} limit.` };
}
