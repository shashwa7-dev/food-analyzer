// The Today energy strip (spec §C screen 5): "Eaten − Burned = Net of {target}". Display only — the
// calorie target and the headline never change with workouts (no eat-back).

export type EnergyLine = { eaten: number; burned: number; net: number; target: number };

/** The strip's figures, rounded to whole kcal; null when nothing was burned (the strip is hidden). */
export function energyLine(eaten: number, burned: number, target: number): EnergyLine | null {
  const b = Math.round(burned);
  if (!(b > 0)) return null;
  const e = Math.round(eaten);
  return { eaten: e, burned: b, net: e - b, target: Math.round(target) };
}

/** The headline's optional suffix: "· 450 burned", or "" when nothing was burned. */
export function burnedSuffix(burned: number): string {
  const b = Math.round(burned);
  return b > 0 ? `· ${b.toLocaleString("en-IN")} burned` : "";
}
