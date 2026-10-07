import type { Nutrients } from "@/lib/nutrition/types";

const MAX_MACRO_G = 100;
const MAX_ENERGY_KCAL = 900;
const ENERGY_TOLERANCE_PCT = 0.15;
const ENERGY_TOLERANCE_ABS_KCAL = 20;
const ENERGY_ABS_THRESHOLD_KCAL = 100;
const KJ_TOLERANCE_PCT = 0.05;
const SALT_TOLERANCE_PCT = 0.1;
const KCAL_PER_PROTEIN = 4;
const KCAL_PER_CARBS = 4;
const KCAL_PER_FAT = 9;
const KCAL_PER_FIBRE = 2; // some labels count carbs net of fibre; +2 kcal/g covers that convention too.
const KJ_PER_KCAL = 4.184;
const SALT_PER_SODIUM_MG = 2.5 / 1000; // saltG ≈ 2.5 × sodiumMg / 1000

function withinTolerance(actual: number, expected: number): boolean {
  if (actual < ENERGY_ABS_THRESHOLD_KCAL) return Math.abs(actual - expected) <= ENERGY_TOLERANCE_ABS_KCAL;
  return Math.abs(actual - expected) / actual <= ENERGY_TOLERANCE_PCT;
}

export function validateFacts(per100: Nutrients, extra?: { energyKj?: number; saltG?: number }): { ok: boolean; failed: string[] } {
  const failed: string[] = [];

  const baseEnergy = KCAL_PER_PROTEIN * per100.protein + KCAL_PER_CARBS * per100.carbs + KCAL_PER_FAT * per100.fat;
  const withFibreEnergy = baseEnergy + KCAL_PER_FIBRE * (per100.fibre ?? 0);
  if (!withinTolerance(per100.energyKcal, baseEnergy) && !withinTolerance(per100.energyKcal, withFibreEnergy)) {
    failed.push("energy");
  }

  if (per100.sugars !== undefined && per100.sugars > per100.carbs) failed.push("sugars");
  if (per100.satFat !== undefined && per100.satFat > per100.fat) failed.push("satFat");

  const macros: (number | undefined)[] = [per100.protein, per100.carbs, per100.fat, per100.sugars, per100.addedSugars, per100.satFat, per100.transFat, per100.fibre];
  const macroOutOfRange = macros.some((v) => typeof v === "number" && v > MAX_MACRO_G);
  if (macroOutOfRange || per100.energyKcal > MAX_ENERGY_KCAL) failed.push("range");

  if (extra?.energyKj !== undefined) {
    const expectedKj = per100.energyKcal * KJ_PER_KCAL;
    if (Math.abs(extra.energyKj - expectedKj) / expectedKj > KJ_TOLERANCE_PCT) failed.push("kj");
  }

  if (extra?.saltG !== undefined && per100.sodiumMg !== undefined) {
    const expectedSalt = per100.sodiumMg * SALT_PER_SODIUM_MG;
    if (expectedSalt > 0 && Math.abs(extra.saltG - expectedSalt) / expectedSalt > SALT_TOLERANCE_PCT) failed.push("salt");
  }

  return { ok: failed.length === 0, failed };
}
