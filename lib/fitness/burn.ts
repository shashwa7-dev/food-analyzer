// Calories burned (spec §C): kcal = MET × weight kg × hours, rounded. With no body weight logged the
// burn assumes 70 kg and says so (`estimated`), and the UI shows "~".
import type { BurnKind, Intensity } from "@/lib/fitness/types";

const MET: Record<BurnKind, Record<Intensity, number>> = {
  gym: { easy: 3.5, moderate: 5.0, hard: 6.0 },
  walk: { easy: 2.8, moderate: 3.5, hard: 4.3 },
  run: { easy: 7.0, moderate: 9.8, hard: 11.5 },
  cycling: { easy: 5.8, moderate: 7.5, hard: 10.0 },
  yoga: { easy: 2.5, moderate: 3.0, hard: 4.0 },
  sport: { easy: 5.0, moderate: 7.0, hard: 9.0 },
};

export const ESTIMATED_WEIGHT_KG = 70;

export function met(kind: BurnKind, intensity: Intensity): number {
  return MET[kind][intensity];
}

export function kcalBurned(p: { kind: BurnKind; intensity: Intensity; minutes: number; weightKg: number | null }): { kcal: number; estimated: boolean; weightKg: number; met: number } {
  const m = met(p.kind, p.intensity);
  const known = p.weightKg !== null && Number.isFinite(p.weightKg) && p.weightKg > 0;
  const weightKg = known ? p.weightKg! : ESTIMATED_WEIGHT_KG;
  const minutes = Number.isFinite(p.minutes) && p.minutes > 0 ? p.minutes : 0;
  return { kcal: Math.round((m * weightKg * minutes) / 60), estimated: !known, weightKg, met: m };
}
