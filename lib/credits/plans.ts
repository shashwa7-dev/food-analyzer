// What each plan includes, and the one check for Pro-only features. Server-side: `allows` reads the
// PRO_GATES_ENFORCED launch switch (lib/env.ts) unless a caller passes it in. The plan table itself is
// in lib/credits/plan-features.ts so client components can use it without lib/env.
import { proGatesEnforced } from "@/lib/env";
import { GATED_FEATURES, planAllows, type GatedFeature, type PlanKey } from "@/lib/credits/plan-features";

export { GATED_FEATURES, PLANS, type GatedFeature, type PlanFeatures, type PlanKey } from "@/lib/credits/plan-features";

/**
 * Whether `plan` may use `feature`. Until Pro launches (PRO_GATES_ENFORCED off) every feature is open
 * to everyone; once enforced, it's the plan's own value. Turning the gates on is that one env value. The AI-scan allowance isn't a gate: it's
 * `PLANS[plan].aiScansPerMonth`, applied by the credit ledger as before.
 */
export function allows(plan: PlanKey, feature: GatedFeature, enforced: boolean = proGatesEnforced()): boolean {
  return planAllows(plan, feature, enforced);
}

/** Which gated features `plan` is locked out of right now: what the client's Pro locks show. */
export function lockedFeatures(plan: PlanKey, enforced: boolean = proGatesEnforced()): Record<GatedFeature, boolean> {
  return Object.fromEntries(GATED_FEATURES.map((f) => [f, !planAllows(plan, f, enforced)])) as Record<GatedFeature, boolean>;
}
