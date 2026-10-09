import { describe, expect, it } from "vitest";
import { resolveSiteUrl } from "./site";

describe("resolveSiteUrl", () => {
  it("prefers NEXT_PUBLIC_SITE_URL and reduces it to an origin", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://santul.app/", VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" }).href).toBe("https://santul.app/");
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://santul.app/some/path?q=1" }).href).toBe("https://santul.app/");
  });
  it("falls back to Vercel's production host, which has no scheme", () => {
    expect(resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "eatri8-ai.vercel.app" }).href).toBe("https://eatri8-ai.vercel.app/");
  });
  it("falls back to localhost, and treats blank values as unset", () => {
    expect(resolveSiteUrl({}).href).toBe("http://localhost:3000/");
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "  ", VERCEL_PROJECT_PRODUCTION_URL: "" }).href).toBe("http://localhost:3000/");
  });
  it("rejects a value that is not an http(s) URL, naming the variable", () => {
    expect(() => resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "santul.app" })).toThrow(/NEXT_PUBLIC_SITE_URL/);
    expect(() => resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "ftp://santul.app" })).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });
});
