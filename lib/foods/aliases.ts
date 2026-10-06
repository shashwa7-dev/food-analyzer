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
