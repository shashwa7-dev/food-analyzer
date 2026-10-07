import type { TargetProgress } from "@/lib/nutrition/totals";

export type Tone = "ok" | "over";

/** "over" once eaten passes the target (exactly on target is still "ok"); drives the red over-target signal. */
export function toneFor(eaten: number, target: number): Tone {
  return target > 0 && eaten > target ? "over" : "ok";
}

export type LimitKey = "sugarsMax" | "sodiumMgMax" | "satFatMax";
export type LimitChip = { key: LimitKey; label: string; total: number; target: number; unit: "g" | "mg"; ratio: number; tone: "near" | "over" };

const LIMITS: { key: LimitKey; label: string; unit: "g" | "mg" }[] = [
  { key: "sugarsMax", label: "Sugar", unit: "g" },
  { key: "sodiumMgMax", label: "Sodium", unit: "mg" },
  { key: "satFatMax", label: "Sat fat", unit: "g" },
];

/** The NEAR_LIMIT share of a limit at which a chip appears. */
export const NEAR_LIMIT = 0.9;

/**
 * Chips for the daily limits (sugar, sodium, saturated fat) at 90% or more of their limit, worst
 * first. Under 90% a limit is not shown; above 100% it is "over", else "near". Fibre is a goal, not
 * a limit, so it never appears.
 */
export function limitChips(progress: TargetProgress[]): LimitChip[] {
  const chips: LimitChip[] = [];
  for (const { key, label, unit } of LIMITS) {
    const p = progress.find((x) => x.key === key);
    if (!p || p.target <= 0) continue;
    const ratio = p.total / p.target;
    if (ratio < NEAR_LIMIT) continue;
    chips.push({ key, label, total: p.total, target: p.target, unit, ratio, tone: ratio > 1 ? "over" : "near" });
  }
  return chips.sort((a, b) => b.ratio - a.ratio);
}
