import { z } from "zod";
import type { DailyTargets, Goal } from "./types";

const general: DailyTargets = { energyKcal: 2000, protein: 60, carbs: 275, fat: 67, fibre: 30, sugarsMax: 50, sodiumMgMax: 2000, satFatMax: 22 };

export const PRESETS: Record<Goal, DailyTargets> = {
  general,
  weight_loss: { ...general, energyKcal: 1700, carbs: 230, fat: 57, satFatMax: 19 },
  muscle: { ...general, protein: 100 },
  low_sugar: { ...general, sugarsMax: 25 },
  low_sodium: { ...general, sodiumMgMax: 1500 },
};

export const TargetsSchema = z.object({
  energyKcal: z.number().int().min(800).max(6000),
  protein: z.number().min(10).max(400),
  carbs: z.number().min(20).max(800),
  fat: z.number().min(10).max(300),
  fibre: z.number().min(5).max(100),
  sugarsMax: z.number().min(5).max(300),
  sodiumMgMax: z.number().min(200).max(6000),
  satFatMax: z.number().min(5).max(100),
}).partial();

export function targetsFor(goal: Goal, overrides?: Partial<DailyTargets> | null): DailyTargets {
  return { ...PRESETS[goal], ...(overrides ?? {}) };
}
