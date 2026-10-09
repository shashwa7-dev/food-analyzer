/**
 * The product's public name, the copy search engines and link previews show, and the address the
 * site is served from. Everything that needs an absolute URL (share images, canonical links,
 * robots, the sitemap) builds on SITE_URL.
 */
export const SITE_NAME = "Santul";
export const SITE_TITLE = "Santul: eat well, train well, stay in balance";
export const SITE_DESCRIPTION =
  "Track meals, workouts and weight in one place. Log Indian dishes in real portions and scan any pack for an honest A–E grade.";
export const SHARE_IMAGE_ALT =
  "Santul: eat well, train well, stay in balance. Three phone screens showing the day's calories, a scanned food's grade and a week of workouts.";

type SiteEnv = { NEXT_PUBLIC_SITE_URL?: string; VERCEL_PROJECT_PRODUCTION_URL?: string };

/**
 * The site's origin: NEXT_PUBLIC_SITE_URL when set, else Vercel's production host (which comes
 * without a scheme), else the local dev server. Blank counts as unset; a path or query is dropped.
 */
export function resolveSiteUrl(env: SiteEnv): URL {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    let url: URL | null = null;
    try { url = new URL(explicit); } catch { /* reported below */ }
    if (!url || (url.protocol !== "http:" && url.protocol !== "https:")) {
      throw new Error("NEXT_PUBLIC_SITE_URL must be a full http(s) URL, e.g. https://santul.app");
    }
    return new URL(url.origin);
  }
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return new URL(`https://${vercel}`);
  return new URL("http://localhost:3000");
}

// Named reads, so Next can inline NEXT_PUBLIC_SITE_URL wherever this module is bundled.
export const SITE_URL = resolveSiteUrl({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
});
