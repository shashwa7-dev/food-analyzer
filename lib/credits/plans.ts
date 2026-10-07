export const PLANS = { basic: { aiScansPerMonth: 20 }, pro: { aiScansPerMonth: 200 } } as const;
export type PlanKey = keyof typeof PLANS;
