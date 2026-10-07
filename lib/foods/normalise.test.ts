import { describe, expect, it } from "vitest";
import { aliasesFor, buildSearchFields, canonicalQuery, normalise, stapleAliasesFor } from "./normalise";

describe("normalise", () => {
  it("lowercases, strips diacritics and punctuation", () => {
    expect(normalise("  Crème Brûlée, (Café)! ")).toBe("creme brulee cafe");
  });
  it("keeps Devanagari letters", () => {
    expect(normalise("दाल तड़का")).toBe("दाल तड़का".normalize("NFC"));
  });
});

describe("canonicalQuery", () => {
  it("replaces Hinglish words with English", () => {
    expect(canonicalQuery("chawal")).toBe("rice");
    expect(canonicalQuery("aloo paratha")).toBe("potato paratha");
  });
  it("fixes known misspellings", () => {
    expect(canonicalQuery("panner")).toBe("paneer");
  });
  it("leaves plain English untouched", () => {
    expect(canonicalQuery("Dal Tadka")).toBe("dal tadka");
  });
});

describe("aliasesFor and buildSearchFields", () => {
  it("adds Hinglish aliases for English names", () => {
    expect(aliasesFor("Rice, white, cooked")).toContain("chawal");
    expect(aliasesFor("Potato curry")).toContain("aloo");
  });
  it("builds the search name from name, brand and aliases", () => {
    expect(buildSearchFields({ name: "Aloo Bhujia", brand: "Sample Brand", aliases: ["potato bhujia"] })).toEqual({
      normName: "aloo bhujia", normBrand: "sample brand", searchName: "aloo bhujia sample brand potato bhujia",
    });
  });
});

describe("stapleAliasesFor", () => {
  it("adds curated staple aliases by whole-word normName match", () => {
    expect(stapleAliasesFor("boiled rice uble chawal")).toEqual(["rice", "chawal"]);
    expect(stapleAliasesFor("hot tea garam chai")).toEqual(["chai", "tea"]);
    expect(stapleAliasesFor("chickpeas curry safed channa curry")).toEqual(["chole", "chana"]);
    expect(stapleAliasesFor("rice upma")).toEqual([]);
    expect(stapleAliasesFor("boiled eggplant")).toEqual([]);
  });
});
