// What each plan includes: plain data, safe to import from client components. The gate check itself
// (`allows`, which reads the PRO_GATES_ENFORCED launch switch) lives server-side in lib/credits/plans.ts.

export interface PlanFeatures {
  aiScansPerMonth: number;
  /** Progress's Month range. */
  progressMonth: boolean;
  /** Exporting your data as CSV (GET /api/v1/export). */
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
export const GATED_FEATURES = ["progressMonth", "dataExport", "customTargets"] as const satisfies readonly GatedFeature[];

/** Whether `plan` may use `feature`, given the launch switch. `allows` in lib/credits/plans.ts reads the switch for you. */
export function planAllows(plan: PlanKey, feature: GatedFeature, enforced: boolean): boolean {
  return !enforced || PLANS[plan][feature];
}
