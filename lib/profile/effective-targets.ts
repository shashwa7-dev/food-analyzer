// The daily targets the app actually uses (spec §B "Custom targets at launch"). Once the Pro gates are
// enforced, a Basic user's targets are the goal's preset: stored overrides are kept but ignored, so
// upgrading later restores them. Every server read of a user's targets goes through here.
import { allows, type PlanKey } from "@/lib/credits/plans";
import { targetsFor } from "@/lib/nutrition/targets";
import type { DailyTargets, Goal } from "@/lib/nutrition/types";
import type { ProfileNotices } from "@/lib/db/schema";

type Overrides = Partial<DailyTargets> | null | undefined;

export function effectiveTargets(
  profile: { plan: PlanKey; goal: Goal; targets: Overrides },
  enforced?: boolean,
): DailyTargets {
  return targetsFor(profile.goal, allows(profile.plan, "customTargets", enforced) ? profile.targets : null);
}

/** Stored overrides only where the plan uses them (null otherwise): what the Me and onboarding forms show. */
export function effectiveOverrides(profile: { plan: PlanKey; targets: Overrides }, enforced?: boolean): Partial<DailyTargets> | null {
  return allows(profile.plan, "customTargets", enforced) ? (profile.targets ?? null) : null;
}

const hasOverrides = (t: Overrides) => !!t && Object.values(t).some((v) => v !== undefined);

/**
 * The one-time "Custom targets are now part of Pro" notice: while enforced, for a plan without custom
 * targets that has overrides stored (now ignored), until dismissed (notices.targetsReset).
 */
export function showTargetsNotice(
  profile: { plan: PlanKey; targets: Overrides; notices: ProfileNotices | null | undefined },
  enforced?: boolean,
): boolean {
  return !allows(profile.plan, "customTargets", enforced) && hasOverrides(profile.targets) && !profile.notices?.targetsReset;
}
