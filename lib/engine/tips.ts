// Static, pure lookups for scan results: the "no better alternative found" category tip
// (spec §7.4) and the model's free-text categoryGuess mapped to OFF category tags (so a label
// scan classifies, finds alternatives and gets a tip exactly like an OFF product would).

const SNACK_TIP = "Roasted chana or makhana are lower in fat and sodium.";
const DRINK_TIP = "Try plain water, unsweetened lassi or nimbu pani without sugar.";
const BISCUIT_TIP = "Plain roasted nuts or fruit are better snack choices.";

// Most specific tag first: a product tagged both en:snacks and en:biscuits gets the biscuit tip.
const CATEGORY_TIPS: [tag: string, tip: string][] = [
  ["en:biscuits", BISCUIT_TIP],
  ["en:sodas", DRINK_TIP],
  ["en:salty-snacks", SNACK_TIP],
  ["en:beverages", DRINK_TIP],
  ["en:snacks", SNACK_TIP],
];

export function tipFor(categories: string[]): string | undefined {
  return CATEGORY_TIPS.find(([tag]) => categories.includes(tag))?.[1];
}

// First matching rule wins; order matters (water before generic drinks, oil before snacks, ...).
const GUESS_RULES: [pattern: RegExp, tags: string[]][] = [
  [/\bwater\b/i, ["en:beverages", "en:waters"]],
  [/\b(soft drinks?|sodas?|colas?|carbonated|fizzy)\b/i, ["en:beverages", "en:sodas"]],
  [/\b(drinks?|beverages?|juices?|nectars?|tea|coffee|lassi|buttermilk|chaas|smoothies?|shakes?|squash)\b/i, ["en:beverages"]],
  [/\boils?\b/i, ["en:fats", "en:vegetable-oils"]],
  [/\b(ghee|(?<!(peanut|nut|cocoa|almond|cashew) )butter|vanaspati|margarine)\b/i, ["en:fats"]],
  [/\b(cheeses?|paneer)\b/i, ["en:cheeses"]],
  [/\b(biscuits?|cookies?|crackers?)\b/i, ["en:snacks", "en:sweet-snacks", "en:biscuits"]],
  [/\b(chocolates?)\b/i, ["en:snacks", "en:sweet-snacks", "en:chocolates"]],
  [/\b(namkeen|bhujia|chips|crisps|savou?ry snacks?|salty snacks?|mixture|chivda|sev)\b/i, ["en:snacks", "en:salty-snacks"]],
  [/\bsnacks?\b/i, ["en:snacks"]],
];

export function categoriesFromGuess(guess: string | undefined): string[] {
  if (!guess) return [];
  return GUESS_RULES.find(([pattern]) => pattern.test(guess))?.[1] ?? [];
}
