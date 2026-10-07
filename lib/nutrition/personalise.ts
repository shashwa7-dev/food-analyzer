import type { DailyTargets, Diet, Flag, Goal, Nutrients } from "./types";

export const ALLERGEN_KEYS = ["peanut", "tree_nut", "milk", "egg", "gluten", "soy", "sesame", "fish", "shellfish", "mustard"] as const;
export type AllergenKey = (typeof ALLERGEN_KEYS)[number];

const ALLERGEN_WORDS: Record<AllergenKey, RegExp> = {
  peanut: /\b(peanuts?|groundnuts?|moongphali|moongfali|mungfali|mungphali)\b/i,
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
// "Peanut butter", "cocoa butter", "coconut milk" etc. are not dairy.
const NON_DAIRY = /\b(peanut|cocoa|apple|nut|almond|cashew|shea|coconut|soy|soya|oat|rice) (butter|milk)\b/gi;
const dairyText = (s: string) => s.replace(NON_DAIRY, "");
export const OFF_TAG: Record<string, AllergenKey> = {
  "en:peanuts": "peanut", "en:nuts": "tree_nut", "en:milk": "milk", "en:eggs": "egg", "en:gluten": "gluten",
  "en:soybeans": "soy", "en:sesame-seeds": "sesame", "en:fish": "fish", "en:crustaceans": "shellfish", "en:mustard": "mustard",
};
const DIET_RULES: Record<Exclude<Diet, "none">, { words: RegExp; label: string }> = {
  vegetarian: { words: /\b(chicken|mutton|lamb|beef|pork|fish|prawns?|shrimps?|shellfish|crab|lobster|eggs?|gelatin|e120|carmine)\b/i, label: "vegetarian" },
  eggetarian: { words: /\b(chicken|mutton|lamb|beef|pork|fish|prawns?|shrimps?|shellfish|crab|lobster|gelatin|e120|carmine)\b/i, label: "eggetarian" },
  vegan: { words: /\b(milk|ghee|butter|paneer|cream|curd|dahi|cheese|whey|casein|yogurt|yoghurt|buttermilk|chaas|lassi|honey|eggs?|chicken|mutton|fish|gelatin|e120|milk solids)\b/i, label: "vegan" },
  jain: { words: /\b(onions?|garlic|potato(es)?|aloo|carrots?|beetroot|radish|ginger|chicken|mutton|fish|shellfish|crab|lobster|eggs?|honey|gelatin)\b/i, label: "Jain" },
};
// Allergens a diet already excludes by definition — no point asking about them.
const DIET_HIDDEN_ALLERGENS: Record<Diet, readonly AllergenKey[]> = {
  none: [],
  vegetarian: ["fish", "shellfish", "egg"],
  jain: ["fish", "shellfish", "egg"],
  eggetarian: ["fish", "shellfish"],
  vegan: ["fish", "shellfish", "egg", "milk"],
};

export function allergensForDiet(diet: Diet): AllergenKey[] {
  const hidden = new Set<AllergenKey>(DIET_HIDDEN_ALLERGENS[diet]);
  return ALLERGEN_KEYS.filter((key) => !hidden.has(key));
}

const CHECK = " Check the pack to confirm.";
const pct = (v: number, of: number) => Math.round((v / of) * 100);

export function personalise(input: {
  name: string; allergens: string[]; ingredients: string[]; mayContain?: string[]; perPortion: Nutrients; portionLabel: string;
  profile: { allergies: string[]; diet: Diet; goal: Goal; targets: DailyTargets };
}): Flag[] {
  const flags: Flag[] = [];
  // Without an ingredient list, the food's name is the best evidence we have ("Paneer butter masala").
  const fromName = input.ingredients.length === 0;
  // Diet rules read the name only when there's no ingredient list ("Chicken flavoured crisps" can be veg).
  const text = fromName ? input.name : input.ingredients.join(", ");
  // Allergen rules always read the name too: ingredient lists can be garbled or incomplete.
  const allergenText = fromName ? input.name : `${text}, ${input.name}`;
  // Plant "milks"/"butters" are stripped only for dairy checks — "Peanut butter" must still flag peanut.
  const allergenDairyText = dairyText(allergenText);
  const dietDairyText = dairyText(text);
  const suffix = fromName ? " Going by the name — check before eating." : CHECK;
  const declared = new Set(input.allergens.map((t) => OFF_TAG[t]).filter(Boolean));
  const traces = new Set((input.mayContain ?? []).map((t) => OFF_TAG[t]).filter(Boolean));
  for (const key of input.profile.allergies as AllergenKey[]) {
    if (!(key in ALLERGEN_WORDS)) continue;
    const label = key.replace("_", " ");
    if (declared.has(key) || ALLERGEN_WORDS[key].test(key === "milk" ? allergenDairyText : allergenText)) {
      flags.push({ type: "allergen", key, severity: "contains", text: `Contains ${label}.${declared.has(key) ? CHECK : suffix}` });
    } else if (traces.has(key)) {
      flags.push({ type: "allergen", key, severity: "may_contain", text: `May contain traces of ${label}.${CHECK}` });
    }
  }
  if (input.profile.diet !== "none" && text) {
    const rule = DIET_RULES[input.profile.diet];
    // Vegan is the only rule with dairy words; the stripped phrases contain no other diet words.
    const hit = (input.profile.diet === "vegan" ? dietDairyText : text).match(rule.words);
    if (hit) flags.push({ type: "diet", key: input.profile.diet, severity: "contains", text: `Not ${rule.label}: contains ${hit[0].toLowerCase()}.${suffix}` });
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
