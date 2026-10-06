import type { Grade, GradeResult, Nutrients, ScoreComponent } from "../types";

export function pointsFor(value: number, thresholds: number[]): number {
  let p = 0;
  for (const t of thresholds) if (value > t) p++;
  return p;
}

const GENERAL = {
  energyKj: [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350],
  sugars: [3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51],
  satFat: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  salt: [0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6, 2.8, 3, 3.2, 3.4, 3.6, 3.8, 4],
  protein: [2.4, 4.8, 7.2, 9.6, 12, 14, 17],
  fibre: [3, 4.1, 5.2, 6.3, 7.4],
};
const BEVERAGE = {
  energyKj: [30, 90, 150, 210, 240, 270, 300, 330, 360, 390],
  sugars: [0.5, 2, 3.5, 5, 6, 7, 8, 9, 10, 11],
  protein: [1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3],
};
const SWEETENERS = new Set(["e950", "e951", "e952", "e954", "e955", "e960", "e961", "e962", "e969"]);

function fvlPoints(pct: number, beverage: boolean) {
  if (beverage) return pct > 80 ? 6 : pct > 60 ? 4 : pct > 40 ? 2 : 0;
  return pct > 80 ? 5 : pct > 60 ? 2 : pct > 40 ? 1 : 0;
}

function generalGrade(score: number): Grade {
  return score <= 0 ? "A" : score <= 2 ? "B" : score <= 10 ? "C" : score <= 18 ? "D" : "E";
}
function beverageGrade(score: number): Grade {
  return score <= 2 ? "B" : score <= 6 ? "C" : score <= 9 ? "D" : "E";
}

// 0–100 display value: linear within each grade's band of the score range.
const GENERAL_BANDS: Record<Grade, [number, number, number, number]> = {
  A: [-15, 0, 100, 80], B: [1, 2, 79, 70], C: [3, 10, 69, 50], D: [11, 18, 49, 30], E: [19, 40, 29, 0],
};
const BEVERAGE_BANDS: Record<Grade, [number, number, number, number]> = {
  A: [-15, 0, 100, 80], B: [-15, 2, 79, 70], C: [3, 6, 69, 50], D: [7, 9, 49, 30], E: [10, 30, 29, 0],
};
function bandValue(score: number, grade: Grade, bands: typeof GENERAL_BANDS) {
  const [lo, hi, vHi, vLo] = bands[grade];
  const s = Math.min(hi, Math.max(lo, score));
  const t = hi === lo ? 0 : (s - lo) / (hi - lo);
  return Math.round(vHi - t * (vHi - vLo));
}
const DOWN: Record<Grade, Grade> = { A: "B", B: "C", C: "D", D: "E", E: "E" };

export function nutriScore(input: {
  per100: Nutrients;
  category: "general" | "beverage" | "water" | "fat_oil" | "cheese";
  fvlPercent?: number;
  additives?: string[];
  nova?: number | null;
}): GradeResult {
  if (input.category === "water") return { grade: "A", value: 100, components: [] };
  const n = input.per100;
  const bev = input.category === "beverage";
  const approximate = input.category === "fat_oil" || input.category === "cheese" ? true : undefined;
  const t = bev ? { ...GENERAL, ...BEVERAGE } : GENERAL;
  const energyKj = n.energyKcal * 4.184;
  const salt = ((n.sodiumMg ?? 0) * 2.5) / 1000;
  const additives = (input.additives ?? []).map((a) => a.toLowerCase().replace(/^en:/, ""));
  const fvlKnown = typeof input.fvlPercent === "number";

  const neg: ScoreComponent[] = [
    { key: "energy", label: "Energy", points: pointsFor(energyKj, t.energyKj), maxPoints: 10, direction: "negative", estimated: false },
    { key: "sugars", label: "Sugars", points: pointsFor(n.sugars ?? 0, t.sugars), maxPoints: t.sugars.length, direction: "negative", estimated: n.sugars === undefined },
    { key: "satFat", label: "Saturated fat", points: pointsFor(n.satFat ?? 0, GENERAL.satFat), maxPoints: 10, direction: "negative", estimated: n.satFat === undefined },
    { key: "salt", label: "Salt", points: pointsFor(salt, GENERAL.salt), maxPoints: 20, direction: "negative", estimated: n.sodiumMg === undefined },
  ];
  if (bev && additives.some((a) => SWEETENERS.has(a))) {
    neg.push({ key: "sweeteners", label: "Sweeteners", points: 4, maxPoints: 4, direction: "negative", estimated: false });
  }
  const N = neg.reduce((s, c) => s + c.points, 0);
  const proteinPts = pointsFor(n.protein, t.protein);
  const countProtein = bev || N < 11;
  const pos: ScoreComponent[] = [
    { key: "protein", label: "Protein", points: countProtein ? proteinPts : 0, maxPoints: 7, direction: "positive", estimated: false },
    { key: "fibre", label: "Fibre", points: pointsFor(n.fibre ?? 0, GENERAL.fibre), maxPoints: 5, direction: "positive", estimated: n.fibre === undefined },
    { key: "fvl", label: "Fruit, vegetables, legumes", points: fvlPoints(input.fvlPercent ?? 0, bev), maxPoints: bev ? 6 : 5, direction: "positive", estimated: !fvlKnown },
  ];
  const P = pos.reduce((s, c) => s + c.points, 0);
  const score = N - P;
  let grade = bev ? beverageGrade(score) : generalGrade(score);
  let value = bandValue(score, grade, bev ? BEVERAGE_BANDS : GENERAL_BANDS);
  const components = [...neg, ...pos];
  const ultra = input.nova === 4 || additives.length >= 3;
  if (ultra && grade !== "E") {
    grade = DOWN[grade];
    value = Math.min(value, (bev ? BEVERAGE_BANDS : GENERAL_BANDS)[grade][2]);
    components.push({ key: "processing", label: "Ultra-processed", points: 1, maxPoints: 1, direction: "negative", estimated: input.nova !== 4 });
  }
  return { grade, value, components: approximate ? components.map((c) => ({ ...c, approximate })) : components };
}
