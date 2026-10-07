import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { THEME_COLOR } from "@/lib/theme";

// The dark palette is declared twice in globals.css (data-theme="dark", and data-theme="system" under
// the OS dark media query) because CSS can't share one declaration list across the two. This keeps them
// identical, and checks the old everyone-gets-dark-on-a-dark-OS block is gone.
const css = readFileSync(resolve(__dirname, "globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** The declarations of the first `{…}` body (no nested braces) that follows `selector`. */
function body(selector: string, from = 0): string {
  const at = css.indexOf(selector, from);
  if (at < 0) throw new Error(`${selector} not found in globals.css`);
  const open = css.indexOf("{", at);
  return css.slice(open + 1, css.indexOf("}", open));
}

function declarations(block: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const decl of block.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const [prop, value] = [decl.slice(0, i).trim(), decl.slice(i + 1).trim().replace(/\s+/g, " ")];
    if (out.has(prop)) throw new Error(`${prop} declared twice`);
    out.set(prop, value);
  }
  return out;
}

describe("globals.css dark palette", () => {
  const dark = declarations(body(':root[data-theme="dark"]'));
  // The palette's media block (the other one is inside the dark: custom variant).
  const mediaAt = css.search(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root/);
  const system = declarations(body(':root[data-theme="system"]', mediaAt));

  it("puts the System block inside the OS dark media query", () => {
    expect(mediaAt).toBeGreaterThan(-1);
    const nextRule = css.indexOf(":root", mediaAt);
    expect(css.slice(nextRule, nextRule + ':root[data-theme="system"]'.length)).toBe(':root[data-theme="system"]');
  });

  it("declares the same tokens with the same values in both dark blocks", () => {
    expect(dark.size).toBeGreaterThan(20);
    expect(Object.fromEntries(system)).toEqual(Object.fromEntries(dark));
    expect(dark.get("color-scheme")).toBe("dark");
  });

  it("has exactly those two dark blocks, and no bare :root rule under the dark media query", () => {
    expect(css.match(/@media \(prefers-color-scheme: dark\)/g)).toHaveLength(2); // the palette and the dark: variant
    expect(css).not.toMatch(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{/);
  });

  it("matches the theme-color constants to --bg in each palette", () => {
    expect(declarations(body(":root {")).get("--bg")).toBe(THEME_COLOR.light);
    expect(dark.get("--bg")).toBe(THEME_COLOR.dark);
  });

  it("keeps the camera tokens on the light :root only (always dark, never redefined)", () => {
    expect(declarations(body(":root {")).get("--viewfinder")).toBeDefined();
    expect(dark.has("--viewfinder")).toBe(false);
  });
});

describe("the shadcn muted aliases", () => {
  // --color-muted is shadcn's muted *fill* and maps to --sunken, so `text-muted` would paint text in the
  // sunken background colour: all but invisible. Muted text is `text-subtle` (or shadcn's
  // `text-muted-foreground`). Review M16.
  const root = resolve(__dirname, "..");
  const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) && !e.name.includes(".test.") ? [join(dir, e.name)] : []);

  it("maps --color-muted to the sunken fill", () => {
    expect(css).toMatch(/--color-muted:\s*var\(--sunken\)/);
  });

  it("never uses text-muted (a fill colour) for text", () => {
    const offenders = ["app", "components", "lib"].flatMap((d) => files(join(root, d)))
      .filter((f) => /(^|[\s"'`:])text-muted(?![\w-])/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
