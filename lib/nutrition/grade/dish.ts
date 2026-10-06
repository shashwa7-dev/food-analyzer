import type { Grade, GradeResult, Nutrients, ScoreComponent } from "../types";

// Tunable constants. Deliberately stricter than the spec §5.3 starting values (sugar, saturated fat, plus a
// fat-share rule) so rich curries don't grade A — recorded as a deviation in the plan's self-review notes.
// Evaluated on one frozen reference portion.
const C = {
  sodium: { over: 600, per: 20, cap: 30 },
  sugars: { over: 10, mult: 2, cap: 25 },
  satFat: { over: 5, mult: 3, cap: 30 },
  energy: { over: 600, per: 10, cap: 20 },
  fatShare: { over: 0.45, penalty: 10 },
  protein: { atLeast: 15, bonus: 5 },
  fibre: { atLeast: 5, bonus: 5 },
};

const band = (v: number): Grade => (v >= 80 ? "A" : v >= 65 ? "B" : v >= 50 ? "C" : v >= 35 ? "D" : "E");

export function dishScore(p: Nutrients): GradeResult {
  const sod = p.sodiumMg ?? 0, sug = p.sugars ?? 0, sat = p.satFat ?? 0;
  const fatShare = p.energyKcal > 0 ? (p.fat * 9) / p.energyKcal : 0;
  const pen = (key: string, label: string, pts: number, max: number, estimated: boolean): ScoreComponent =>
    ({ key, label, points: Math.round(pts * 10) / 10, maxPoints: max, direction: "negative", estimated });
  const components: ScoreComponent[] = [
    pen("sodium", "Sodium", Math.min(C.sodium.cap, Math.max(0, (sod - C.sodium.over) / C.sodium.per)), C.sodium.cap, p.sodiumMg === undefined),
    pen("sugars", "Sugars", Math.min(C.sugars.cap, Math.max(0, (sug - C.sugars.over) * C.sugars.mult)), C.sugars.cap, p.sugars === undefined),
    pen("satFat", "Saturated fat", Math.min(C.satFat.cap, Math.max(0, (sat - C.satFat.over) * C.satFat.mult)), C.satFat.cap, p.satFat === undefined),
    pen("energy", "Calories", Math.min(C.energy.cap, Math.max(0, (p.energyKcal - C.energy.over) / C.energy.per)), C.energy.cap, false),
    pen("fatShare", "Share of calories from fat", fatShare > C.fatShare.over ? C.fatShare.penalty : 0, C.fatShare.penalty, false),
    { key: "protein", label: "Protein", points: p.protein >= C.protein.atLeast ? C.protein.bonus : 0, maxPoints: C.protein.bonus, direction: "positive", estimated: false },
    { key: "fibre", label: "Fibre", points: (p.fibre ?? 0) >= C.fibre.atLeast ? C.fibre.bonus : 0, maxPoints: C.fibre.bonus, direction: "positive", estimated: p.fibre === undefined },
  ];
  const raw = 100 - components.filter((c) => c.direction === "negative").reduce((s, c) => s + c.points, 0)
    + components.filter((c) => c.direction === "positive").reduce((s, c) => s + c.points, 0);
  const value = Math.round(Math.min(100, Math.max(0, raw)));
  return { grade: band(value), value, components };
}
