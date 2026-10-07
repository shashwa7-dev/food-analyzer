export type FoodIconKey = "package" | "drink" | "bowl" | "wheat" | "milk" | "egg" | "fruit" | "snack" | "default";

const RULES: [FoodIconKey, RegExp][] = [
  ["drink", /\b(chai|tea|coffee|lassi|juice|shake|smoothie|soda|cola|buttermilk|chaas|nimbu pani|sharbat)\b/],
  ["egg", /\b(egg|omelette|omelet|anda)\b/],
  ["wheat", /\b(roti|chapati|chapatti|phulka|paratha|naan|kulcha|bread|toast|puri|poori|bhatura|thepla|dosa|dosai|uttapam|uthappam|appam|chilla|cheela|pancake)\b/],
  ["milk", /\b(milk|curd|dahi|yogurt|yoghurt|paneer|cheese|raita|kheer)\b/],
  ["snack", /\b((?:peanuts?|groundnuts?)(?! (?:butter|oil|spread))|makhana|samosa|pakora|bhaji|namkeen|bhujia|biscuit|cookie|cake|chips|ladoo|laddu|jalebi|gulab jamun|barfi|halwa|mithai|chocolate|kachori|vada|vadai|bonda|dhokla|khandvi|chakli|mathri)\b/],
  ["fruit", /\b(banana|apple|mango|orange|papaya|grapes|guava|watermelon|pomegranate|fruit|salad)\b/],
  ["bowl", /\b(dal|daal|rice|khichdi|curry|sabzi|sabji|rajma|chole|chana|sambar|rasam|biryani|pulao|poha|upma|idli|idly|pongal|soup|korma|makhani|kadhi|stew|bowl)\b/],
];

const plain = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** The name's keyword family (the icon its words alone would pick), whatever the source; null for none. */
export function nameFamily(name: string): Exclude<FoodIconKey, "package" | "default"> | null {
  const text = plain(name);
  for (const [key, re] of RULES) if (re.test(text)) return key as Exclude<FoodIconKey, "package" | "default">;
  return null;
}

export function foodIconKey(f: { name: string; source: string; barcode?: string | null; gradeCategory?: string | null; categories?: string[] | null }): FoodIconKey {
  if (f.source === "off" || f.barcode) return "package";
  if (f.gradeCategory === "beverage" || f.gradeCategory === "water") return "drink";
  const text = plain([f.name, ...(f.categories ?? [])].join(" "));
  for (const [key, re] of RULES) if (re.test(text)) return key;
  return "default";
}
