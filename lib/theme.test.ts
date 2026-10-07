import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { DARK_QUERY, THEME_COLOR, THEME_SCRIPT, parseTheme, themeCookie } from "./theme";

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

describe("themeCookie", () => {
  it("stores the choice site-wide for a year, SameSite=Lax", () => {
    expect(themeCookie("light")).toBe("eatri8-theme=light; Max-Age=31536000; Path=/; SameSite=Lax");
  });
});

describe("THEME_SCRIPT (the blocking <head> script)", () => {
  /** Runs the script against a fake document; returns what it stamped. */
  function run(cookie: string, osDark = false) {
    const metas = [{ attrs: {} as Record<string, string>, setAttribute(k: string, v: string) { this.attrs[k] = v; } }, { attrs: {} as Record<string, string>, setAttribute(k: string, v: string) { this.attrs[k] = v; } }];
    const documentElement = { dataset: {} as Record<string, string> };
    const document = { cookie, documentElement, querySelectorAll: () => metas };
    const matchMedia = (q: string) => ({ matches: q === DARK_QUERY && osDark });
    runInNewContext(THEME_SCRIPT, { document, matchMedia });
    return { theme: documentElement.dataset.theme, colors: metas.map((m) => m.attrs.content) };
  }
  const value = (cookie: string) => cookie.split(/;\s*/).find((c) => c.startsWith("eatri8-theme="))?.slice("eatri8-theme=".length);

  it("agrees with parseTheme on every cookie string", () => {
    const cookies = [
      "", "eatri8-theme=dark", "eatri8-theme=light", "eatri8-theme=system", "eatri8-theme=", "eatri8-theme=Light", "eatri8-theme=sepia",
      "eatri8-theme=light%20", "a=1; eatri8-theme=light", "a=1;eatri8-theme=system; b=2", "session=x; eatri8-theme=junk",
      "xeatri8-theme=light", "my-eatri8-theme=light; other=1", "eatri8-theme=constructor", "eatri8-theme=__proto__", "eatri8-theme=indexOf",
    ];
    for (const c of cookies) expect(run(c).theme, c).toBe(parseTheme(value(c)));
  });

  it("points every theme-color meta at the colour shown", () => {
    expect(run("").colors).toEqual([THEME_COLOR.dark, THEME_COLOR.dark]);
    expect(run("eatri8-theme=light", true).colors).toEqual([THEME_COLOR.light, THEME_COLOR.light]);
    expect(run("eatri8-theme=system", false).colors).toEqual([THEME_COLOR.light, THEME_COLOR.light]);
    expect(run("eatri8-theme=system", true).colors).toEqual([THEME_COLOR.dark, THEME_COLOR.dark]);
  });

  it("never throws: a document without cookies leaves the static default", () => {
    expect(() => runInNewContext(THEME_SCRIPT, {})).not.toThrow();
  });
});
