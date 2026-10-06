import { ENGLISH_TO_HINGLISH, HINGLISH, MISSPELLINGS, STAPLE_ALIASES } from "./aliases";

export function normalise(s: string): string {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // escape sequence, not literal combining characters
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function canonicalQuery(q: string): string {
  return normalise(q).split(" ").filter(Boolean).map((w) => HINGLISH[w] ?? MISSPELLINGS[w] ?? w).join(" ");
}

export function aliasesFor(name: string): string[] {
  const words = normalise(name).split(" ");
  const out = new Set<string>();
  for (const w of words) for (const hi of ENGLISH_TO_HINGLISH[w] ?? []) out.add(hi);
  return [...out];
}

/** Curated staple aliases for a normalised food name (whole-word phrase match). */
export function stapleAliasesFor(normName: string): string[] {
  const padded = ` ${normName} `;
  const out = new Set<string>();
  for (const [phrase, aliases] of STAPLE_ALIASES) if (padded.includes(` ${phrase} `)) for (const a of aliases) out.add(a);
  return [...out];
}

export function buildSearchFields(f: { name: string; brand?: string | null; aliases?: string[] }) {
  const normName = normalise(f.name);
  const normBrand = f.brand ? normalise(f.brand) : "";
  const searchName = [normName, normBrand, ...(f.aliases ?? []).map(normalise)].filter(Boolean).join(" ");
  return { normName, normBrand, searchName };
}
