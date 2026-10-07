import { PRESETS } from "@/lib/nutrition/targets";
import type { DailyTargets, Goal } from "@/lib/nutrition/types";
import { parseTarget } from "@/lib/profile/parse-target";

type Overrides = Partial<DailyTargets>;

/** Same override keys with the same values (key order and undefined keys don't matter). */
export function sameOverrides(a: Overrides | null | undefined, b: Overrides | null | undefined): boolean {
  const entries = (o: Overrides | null | undefined) => Object.entries(o ?? {}).filter(([, v]) => v !== undefined);
  const ea = entries(a);
  const eb = new Map(entries(b));
  return ea.length === eb.size && ea.every(([k, v]) => eb.get(k) === v);
}

/**
 * What a targets write means for a plan without custom targets (Pro gate on, Basic plan):
 * - "unchanged": the overrides already stored, sent back as they are (a redone onboarding) — leave them;
 * - "preset": every sent value is the goal's own preset — the same as going back to the presets (null);
 * - "custom": a real change to custom targets, which the plan doesn't include.
 */
export function gatedTargetsWrite(sent: Overrides, stored: Overrides | null, goal: Goal): "unchanged" | "preset" | "custom" {
  if (sameOverrides(sent, stored)) return "unchanged";
  const preset = PRESETS[goal];
  const keys = Object.keys(sent) as (keyof DailyTargets)[];
  if (keys.every((k) => sent[k] === undefined || sent[k] === preset[k])) return "preset";
  return "custom";
}

/**
 * Onboarding's targets for saveProfile from the targets step's typed fields: overrides only where a
 * value differs from the goal's preset (null when none do). No fields (the step was never reached) or
 * no custom targets on this plan (the fields are read-only presets): `targets` is left out, so the
 * stored value is kept and a Basic plan never sends custom targets. `bad`: fields that don't parse.
 */
export function targetsToSave(
  fields: Record<keyof DailyTargets, string> | null, goal: Goal, customTargets: boolean,
): { ok: true; targets?: Overrides | null } | { ok: false; bad: Set<keyof DailyTargets> } {
  if (!fields || !customTargets) return { ok: true };
  const preset = PRESETS[goal];
  const out: Overrides = {};
  const bad = new Set<keyof DailyTargets>();
  for (const k of Object.keys(preset) as (keyof DailyTargets)[]) {
    const v = parseTarget(fields[k]);
    if (v === null) continue;
    if (Number.isNaN(v)) bad.add(k);
    else if (v !== preset[k]) out[k] = v;
  }
  if (bad.size) return { ok: false, bad };
  return { ok: true, targets: Object.keys(out).length ? out : null };
}
