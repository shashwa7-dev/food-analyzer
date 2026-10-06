import type { DailyTargets, Diet, Flag, Goal, Nutrients } from "./types";

export const ALLERGEN_KEYS = ["peanut", "tree_nut", "milk", "egg", "gluten", "soy", "sesame", "fish", "shellfish", "mustard"] as const;
export type AllergenKey = (typeof ALLERGEN_KEYS)[number];

const ALLERGEN_WORDS: Record<AllergenKey, RegExp> = {
  peanut: /\b(peanuts?|groundnuts?|moongphali|mungfali)\b/i,
  tree_nut: /\b(almonds?|badam|cashews?|kaju|walnuts?|akhrot|pistachios?|pista|hazelnuts?)\b/i,
  milk: /\b(milk|paneer|ghee|butter|cream|malai|khoa|khoya|curd|dahi|cheese|whey|casein|lactose|milk solids|yogurt|yoghurt|buttermilk|chaas|lassi)\b/i,
  egg: /\b(eggs?|anda|albumin)\b/i,
  gluten: /\b(wheat|atta|maida|suji|sooji|semolina|rava|barley|rye|gluten)\b/i,
  soy: /\b(soy|soya|soybeans?|tofu)\b/i,
  sesame: /\b(sesame|til|gingelly)\b/i,
  fish: /\b(fish|anchov(y|ies)|tuna|salmon|sardines?)\b/i,
  shellfish: /\b(prawns?|shrimps?|crab|lobster|shellfish)\b/i,
  mustard: /\b(mustard|sarson|rai)\b/i,
};
const OFF_TAG: Record<string, AllergenKey> = {
  "en:peanuts": "peanut", "en:nuts": "tree_nut", "en:milk": "milk", "en:eggs": "egg", "en:gluten": "gluten",
  "en:soybeans": "soy", "en:sesame-seeds": "sesame", "en:fish": "fish", "en:crustaceans": "shellfish", "en:mustard": "mustard",
};
const DIET_RULES: Record<Exclude<Diet, "none">, { words: RegExp; label: string }> = {
  vegetarian: { words: /\b(chicken|mutton|lamb|beef|pork|fish|prawns?|shrimps?|shellfish|crab|lobster|eggs?|gelatin|e120|carmine)\b/i, label: "vegetarian" },
  eggetarian: { words: /\b(chicken|mutton|lamb|beef|pork|fish|prawns?|shrimps?|shellfish|crab|lobster|gelatin|e120|carmine)\b/i, label: "eggetarian" },
  vegan: { words: /\b(milk|ghee|butter|paneer|cream|curd|dahi|cheese|whey|casein|yogurt|yoghurt|buttermilk|chaas|lassi|honey|eggs?|chicken|mutton|fish|gelatin|e120|milk solids)\b/i, label: "vegan" },
  jain: { words: /\b(onions?|garlic|potato(es)?|aloo|carrots?|beetroot|radish|ginger|chicken|mutton|fish|shellfish|crab|lobster|eggs?|honey|gelatin)\b/i, label: "Jain" },
};
const CHECK = " Check the pack to confirm.";
const pct = (v: number, of: number) => Math.round((v / of) * 100);

export function personalise(input: {
  allergens: string[]; ingredients: string[]; mayContain?: string[]; perPortion: Nutrients; portionLabel: string;
  profile: { allergies: string[]; diet: Diet; goal: Goal; targets: DailyTargets };
}): Flag[] {
  const flags: Flag[] = [];
  const text = input.ingredients.join(", ");
  const declared = new Set(input.allergens.map((t) => OFF_TAG[t]).filter(Boolean));
  const traces = new Set((input.mayContain ?? []).map((t) => OFF_TAG[t]).filter(Boolean));
  for (const key of input.profile.allergies as AllergenKey[]) {
    if (!(key in ALLERGEN_WORDS)) continue;
    const label = key.replace("_", " ");
    if (declared.has(key) || ALLERGEN_WORDS[key].test(text)) {
      flags.push({ type: "allergen", key, severity: "contains", text: `Contains ${label}.${CHECK}` });
    } else if (traces.has(key)) {
      flags.push({ type: "allergen", key, severity: "may_contain", text: `May contain traces of ${label}.${CHECK}` });
    }
  }
  if (input.profile.diet !== "none" && text) {
    const rule = DIET_RULES[input.profile.diet];
    const hit = text.match(rule.words);
    if (hit) flags.push({ type: "diet", key: input.profile.diet, severity: "contains", text: `Not ${rule.label}: contains ${hit[0].toLowerCase()}.${CHECK}` });
  }
  const t = input.profile.targets, p = input.perPortion;
  const limits: [string, number | undefined, number, string][] = [
    ["sodium", p.sodiumMg, t.sodiumMgMax, "sodium"], ["sugars", p.sugars, t.sugarsMax, "sugar"], ["satFat", p.satFat, t.satFatMax, "saturated fat"],
  ];
  for (const [key, v, max, label] of limits) {
    if (typeof v === "number" && v > max * 0.2) {
      flags.push({ type: "goal", key, severity: "note", text: `${input.portionLabel} uses ${pct(v, max)}% of your daily ${label} limit.` });
    }
  }
  if (p.energyKcal > t.energyKcal * 0.35) {
    flags.push({ type: "goal", key: "energy", severity: "note", text: `${input.portionLabel} is ${pct(p.energyKcal, t.energyKcal)}% of your daily calories.` });
  }
  return flags;
}
