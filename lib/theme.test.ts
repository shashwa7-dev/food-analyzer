import { describe, expect, it } from "vitest";
import { THEME_COLOR, nextTheme, parseTheme, themeColorFor, themeCookie } from "./theme";

describe("parseTheme", () => {
  it("keeps the three valid choices", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("system")).toBe("system");
  });
  it("defaults a missing cookie to dark", () => {
    expect(parseTheme(undefined)).toBe("dark");
    expect(parseTheme(null)).toBe("dark");
    expect(parseTheme("")).toBe("dark");
  });
  it("defaults anything invalid to dark", () => {
    for (const v of ["Dark", "LIGHT", " light", "auto", "sepia", "dark;", "constructor", "__proto__"]) expect(parseTheme(v)).toBe("dark");
  });
});

describe("nextTheme", () => {
  it("cycles Dark → Light → System → Dark", () => {
    expect(nextTheme("dark")).toBe("light");
    expect(nextTheme("light")).toBe("system");
    expect(nextTheme("system")).toBe("dark");
  });
});

describe("themeCookie", () => {
  it("stores the choice site-wide for a year, SameSite=Lax", () => {
    expect(themeCookie("light")).toBe("eatri8-theme=light; Max-Age=31536000; Path=/; SameSite=Lax");
  });
});

describe("themeColorFor", () => {
  it("is one colour for a fixed choice and the media pair for System", () => {
    expect(themeColorFor("dark")).toBe(THEME_COLOR.dark);
    expect(themeColorFor("light")).toBe(THEME_COLOR.light);
    expect(themeColorFor("system")).toEqual([
      { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
      { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
    ]);
  });
});
