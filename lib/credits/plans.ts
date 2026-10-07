// What each plan includes, and the one check for Pro-only features. Server-side: `allows` reads the
// PRO_GATES_ENFORCED launch switch (lib/env.ts) unless a caller passes it in.
import { proGatesEnforced } from "@/lib/env";

export interface PlanFeatures {
  aiScansPerMonth: number;
  /** Progress's Month range. */
  progressMonth: boolean;
  /** Exporting your data as CSV (not built yet; see components/me/account-footer.tsx). */
  dataExport: boolean;
  /** Daily targets other than the goal's preset. */
  customTargets: boolean;
}

export const PLANS = {
  basic: { aiScansPerMonth: 20, progressMonth: false, dataExport: false, customTargets: false },
  pro: { aiScansPerMonth: 200, progressMonth: true, dataExport: true, customTargets: true },
} as const satisfies Record<string, PlanFeatures>;
export type PlanKey = keyof typeof PLANS;

export type GatedFeature = { [K in keyof PlanFeatures]: PlanFeatures[K] extends boolean ? K : never }[keyof PlanFeatures];

/**
 * Whether `plan` may use `feature`. Until Pro launches (PRO_GATES_ENFORCED off) every feature is open
 * to everyone; once enforced, it's the plan's own value. Turning the gates on is that one env value. The AI-scan allowance isn't a gate: it's
 * `PLANS[plan].aiScansPerMonth`, applied by the credit ledger as before.
 */
export function allows(plan: PlanKey, feature: GatedFeature, enforced: boolean = proGatesEnforced()): boolean {
  return !enforced || PLANS[plan][feature];
}
