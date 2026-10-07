// Hinglish/Hindi word → English canonical word. Extend freely; keep lowercase ASCII keys.
export const HINGLISH: Record<string, string> = {
  chawal: "rice", bhaat: "rice", aloo: "potato", alu: "potato", gobhi: "cauliflower", gobi: "cauliflower",
  palak: "spinach", baingan: "brinjal", bhindi: "okra", matar: "peas", mattar: "peas", gajar: "carrot",
  pyaz: "onion", pyaaz: "onion", tamatar: "tomato", dahi: "curd", doodh: "milk", anda: "egg", ande: "egg",
  murgh: "chicken", murg: "chicken", machli: "fish", macchi: "fish", gosht: "mutton", chai: "tea",
  makai: "corn", makki: "corn", chana: "chickpea", chole: "chickpea", rajma: "kidney bean", daal: "dal",
  roti: "chapati", phulka: "chapati", sabzi: "vegetable", sabji: "vegetable", kela: "banana", seb: "apple",
  aam: "mango", nimbu: "lemon", mirch: "chilli", lassi: "buttermilk", chaas: "buttermilk", makhan: "butter",
};
export const MISSPELLINGS: Record<string, string> = {
  panner: "paneer", panir: "paneer", biriyani: "biryani", briyani: "biryani", chapathi: "chapati", chappati: "chapati",
  idly: "idli", dosai: "dosa", sambhar: "sambar", rasam: "rasam", poori: "puri", parantha: "paratha", paratha: "paratha",
};
export const ENGLISH_TO_HINGLISH: Record<string, string[]> = Object.entries(HINGLISH).reduce((acc, [hi, en]) => {
  (acc[en] ??= []).push(hi);
  return acc;
}, {} as Record<string, string[]>);

// Curated aliases for everyday staples, so a one-word query ("rice", "chai", "chole") ranks the plain food first.
// Key: a phrase matched as whole words inside the food's normalised name. Value: exact query words it answers.
export const STAPLE_ALIASES: [phrase: string, aliases: string[]][] = [
  ["boiled rice", ["rice", "chawal"]],
  // "chawal" means Indian boiled rice — only the INDB staple answers it exactly.
  ["rice cooked nfs", ["rice"]],
  ["rice white cooked no added fat", ["rice"]],
  ["hot tea garam chai", ["chai", "tea"]],
  ["boiled egg", ["egg", "anda"]],
  ["egg whole boiled", ["egg", "anda"]],
  ["banana raw", ["banana", "kela"]],
  ["apple raw", ["apple", "seb"]],
  ["chapati roti", ["roti", "chapati"]],
  ["chickpeas curry", ["chole", "chana"]],
  ["kidney bean curry", ["rajma"]],
  ["yogurt nfs", ["curd", "dahi"]],
  ["instant coffee", ["coffee"]],
  ["coffee brewed", ["coffee"]],
];
