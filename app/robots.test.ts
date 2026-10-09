import { describe, expect, it } from "vitest";
import { APP_PREFIXES } from "@/lib/nav/app-prefixes";
import robots from "./robots";
import sitemap from "./sitemap";

describe("robots and sitemap", () => {
  it("disallows the API and every signed-in prefix", () => {
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0]! : rules;
    const disallow = ([] as string[]).concat(rule.disallow ?? []);
    expect(disallow).toContain("/api/");
    for (const p of APP_PREFIXES) expect(disallow).toContain(p);
    expect(rule.allow).toBe("/");
  });
  it("points at the sitemap, which lists exactly the four public pages", () => {
    expect(robots().sitemap).toMatch(/\/sitemap\.xml$/);
    expect(sitemap().map((e) => new URL(e.url).pathname).sort()).toEqual(["/", "/about/data", "/privacy", "/terms"]);
  });
});
