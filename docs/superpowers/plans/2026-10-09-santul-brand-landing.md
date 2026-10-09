# Santul Rebrand, Home Page and Share Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the product to Santul everywhere a person sees it, ship the split-plate logo, replace the home and sign-in pages with the approved one-screen page, and add titles, share cards, icons, robots and a sitemap.

**Architecture:** One module (`lib/site.ts`) owns the name, copy and site address. One server component (`components/marketing/landing.tsx`) renders both `/` and `/sign-in`. All raster assets (share card, icons, landing screenshots) are static files produced by one dev script (`pnpm brand:assets`) and committed, so builds need no image renderer.

**Tech Stack:** Next.js 16.3 App Router (read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/*.md` before touching metadata files), React 19, Tailwind 4, lucide-react, vitest, puppeteer-core + installed Chrome, sharp.

**Spec:** `docs/superpowers/specs/2026-10-09-santul-brand-landing-design.md`
**Mocks (git-ignored, the visual source of truth):** `.superpowers/brainstorm/21347-1791554966/content/landing-one-screen-v3.html` (desktop), `mobile-and-og.html` (phone option A and the share card), `santul-split-plate-refine.html` (logo).

## Global Constraints

- Hidden identifiers keep the old name: `eatri8-theme`, `eatri8-workout-draft:*`, `eatri8-trends-tab`, `eatri8:in-app-nav`, the `eatri8-workout-draft` event, database names, `package.json` name, CI and docker-compose names. Do not touch them.
- Running text says "Santul"; only the wordmark is lowercase `santul`.
- Mark colours are fixed in both themes: tile `#12150F`, left half `#A6D84A`, right half `#EDF1E6`; cut rotated `rotate(24 60 60)`.
- Buttons never wrap onto two lines. The `md` breakpoint is 900 px.
- Muted text is `text-subtle`, never `text-muted`.
- Commit after each task; never push.

## Review Focus

1. **A phone shorter than 844 px (e.g. 667 px):** the pinned sign-in bar must not cover the headline or leave the last feature row unreachable; scrolling to the end shows the whole feature card above the bar. Pinned by the UI audit check in Task 6.
2. **`NEXT_PUBLIC_SITE_URL` set with a trailing slash, a path, or garbage:** `SITE_URL` normalises to an origin, and garbage throws at load with a message naming the variable. Unit test in Task 1.
3. **Light theme:** the lime headline line and feature icons must stay readable on `#FAFBF6`; screenshots must switch with the theme including `data-theme="system"`. UI audit in Task 6 (Light, 390 and 1280).
4. **Window between 900 and 1100 px wide:** the side phones hide and nothing overlaps the text. Manual screenshot at 960 px in Task 6.
5. **A signed-in page reached by a crawler or shared link:** it redirects to `/sign-in`, which is `noindex` with canonical `/`; `robots.txt` disallows every prefix in `proxy.ts`. Unit test in Task 5 imports `APP_PREFIXES` so a new prefix cannot be forgotten.

---

### Task 1: `lib/site.ts`

**Files:** Create `lib/site.ts`, `lib/site.test.ts`. Modify `.env.example`.

**Interfaces — Produces:**
```ts
export const SITE_NAME = "Santul";
export const SITE_TITLE = "Santul: eat well, train well, stay in balance";
export const SITE_DESCRIPTION = "Track meals, workouts and weight in one place. Log Indian dishes in real portions and scan any pack for an honest A–E grade.";
export const SHARE_IMAGE_ALT = "Santul: eat well, train well, stay in balance. Three phone screens showing the day's calories, a scanned food's grade and a week of workouts.";
export function resolveSiteUrl(env: { NEXT_PUBLIC_SITE_URL?: string; VERCEL_PROJECT_PRODUCTION_URL?: string }): URL;
export const SITE_URL: URL; // resolveSiteUrl(process.env)
```

- [ ] **Step 1: failing test** `lib/site.test.ts`:
```ts
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
```
- [ ] **Step 2:** `pnpm vitest run lib/site.test.ts` → FAIL (module missing).
- [ ] **Step 3:** implement: trim; if set, `new URL()` in try/catch, require `http:`/`https:`, return `new URL(url.origin)`; else Vercel host with `https://`; else localhost. Throw `Error("NEXT_PUBLIC_SITE_URL must be a full http(s) URL, e.g. https://santul.app")`.
- [ ] **Step 4:** test passes. Add `NEXT_PUBLIC_SITE_URL=` with a one-line comment to `.env.example`.
- [ ] **Step 5:** commit `feat(site): site name, copy and address in lib/site.ts`.

### Task 2: Logo and visible renames

**Files:** Modify `components/brand/logo.tsx`, `components/marketing/marketing-page.tsx`, `components/scan/scan-flow.tsx`, `app/api/v1/export/route.ts` (+ `route.int.test.ts`), `lib/engine/off.ts` (+ `off.test.ts`), `app/(marketing)/privacy/page.tsx`, `terms/page.tsx`, `about/data/page.tsx`, `README.md`.

**Interfaces — Produces:** `LogoMark({ className?: string })` (inline SVG, `aria-hidden`, sized with `size-*`), `Logo({ className?: string })` (lockup, sized with `text-*`, sr-only "Santul").

- [ ] **Step 1:** update the two tests first: export file names `santul-diary-…` / `santul-workouts-`, User-Agent `Santul/2.0 (ops@eatri8.app)` (the test's contact email is a fixture; leave it). Run `pnpm vitest run lib/engine/off.test.ts` → FAIL.
- [ ] **Step 2:** `logo.tsx`:
```tsx
import { cn } from "@/lib/utils";

/** The Santul mark, "the split plate": fixed brand colours in both themes. Size it with a size-* class. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={cn("shrink-0", className)} aria-hidden="true">
      <rect x="0.5" y="0.5" width="119" height="119" rx="28" fill="#12150F" stroke="rgb(255 255 255 / .16)" />
      <g transform="rotate(24 60 60)">
        <path d="M57 23A31 31 0 0 0 57 85Z" fill="#A6D84A" />
        <path d="M63 35A31 31 0 0 1 63 97Z" fill="#EDF1E6" />
      </g>
    </svg>
  );
}

/** The Santul lockup: the mark and the lowercase wordmark. Size it with a text-* class. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-[0.36em] font-bold tracking-[-0.045em] whitespace-nowrap text-ink", className)}>
      <LogoMark className="size-[1.25em]" />
      <span className="sr-only">Santul</span>
      <span aria-hidden>santul</span>
    </span>
  );
}
```
- [ ] **Step 3:** rename in the listed files (copy, `aria-label="Santul home"`, network message, export file name, User-Agent). Page `metadata.title` values become the short form (`"Privacy"`, `"Terms"`, `"Data sources"`); the template arrives in Task 5.
- [ ] **Step 4:** README: product name → Santul throughout; keep every identifier from Global Constraints; add one sentence under the intro: internal identifiers still say `eatri8` on purpose (renaming them would reset users' theme and in-progress workouts).
- [ ] **Step 5:** `pnpm vitest run lib/engine/off.test.ts`, `pnpm typecheck`, `pnpm lint` pass. Commit `feat(brand): Santul logo and visible renames`.

### Task 3: Brand assets script and static files

**Files:** Create `scripts/brand-assets.ts`, `scripts/brand/mark.ts` (the mark's SVG strings), `scripts/brand/share-card.ts` (HTML template function). Add `"brand:assets"` to `package.json` scripts. Generated and committed: `app/icon.svg`, `app/favicon.ico`, `app/apple-icon.png`, `app/opengraph-image.png`, `app/opengraph-image.alt.txt`, `app/twitter-image.png`, `app/twitter-image.alt.txt`, `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `public/landing/{today,scan,workouts}-{dark,light}.webp`. Delete `app/icon.tsx`, `app/apple-icon.tsx`. Modify `app/manifest.ts`, `README.md`.

**Interfaces — Consumes:** `SHARE_IMAGE_ALT` from Task 1; `launch` from `scripts/lib/browser.ts`. **Produces:** the files above; Task 4 uses `/landing/{name}-{theme}.webp` at 584 × 1213.

- [ ] **Step 1:** `scripts/brand/mark.ts` exports `markSvg({ rounded, scale }: { rounded: boolean; scale?: number })`: the 120 × 120 SVG; `rounded: false` gives a full-bleed ink square (Apple, maskable); `scale` (default 1) shrinks the two halves about the centre (0.7 for maskable). No hairline stroke in exported assets.
- [ ] **Step 2:** `scripts/brand-assets.ts` (run with `tsx`):
  - Sources: `docs/design/qa/{today,scan-label,workouts}-390-{dark,light}.png`. If any is missing, exit 1 with "Run pnpm ui:audit first (needs pnpm dev and pnpm seed:demo)."
  - Landing shots: `sharp(src).extract({ left: 0, top: 0, width: 780, height: 1620 }).resize(584).webp({ quality: 80 })` → `public/landing/{today|scan|workouts}-{theme}.webp`.
  - Icons with `sharp(Buffer.from(svg), { density: 600 }).resize(n).png()`: 180 (square), 192, 512 (rounded), maskable 512 (square, scale 0.7). `app/icon.svg` is `markSvg({ rounded: true })` written as text.
  - `favicon.ico`: a 32 px PNG wrapped in an ICO container (6-byte header `00 00 01 00 01 00`, one 16-byte entry: width 32, height 32, 0 colours, 0 reserved, planes 1, bpp 32, PNG byte length, offset 22, then the PNG).
  - Share card: `launch()`, a page at 1200 × 630 with `deviceScaleFactor: 1`, `setContent(shareCardHtml({ mark, shots }))` where the three dark shots are inlined as base64 data URIs, wait for `document.fonts.ready`, screenshot PNG, then `sharp(...).png({ compressionLevel: 9, palette: false })`. Write to `app/opengraph-image.png` and copy to `app/twitter-image.png`; write both `.alt.txt` files from `SHARE_IMAGE_ALT`.
  - Print each file with its size; exit 1 if the share card exceeds 400 KB or a landing shot exceeds 60 KB.
- [ ] **Step 3:** `scripts/brand/share-card.ts`: port the `.pg.og` block of `mobile-and-og.html` to a standalone document (Geist from Google Fonts, 1200 × 630, lockup at 72/64, headline 84 px at top 176, lede 28 px nowrap, phones at left 694/796/960 as in the mock).
- [ ] **Step 4:** `pnpm brand:assets`; open the share card and one icon with the Read tool and compare with the mock.
- [ ] **Step 5:** delete `app/icon.tsx` and `app/apple-icon.tsx`. `app/manifest.ts`: name and short_name "Santul"; icons `/icons/icon-192.png` (192x192), `/icons/icon-512.png` (512x512), `/icons/icon-maskable-512.png` (512x512, `purpose: "maskable"`).
- [ ] **Step 6:** README: document `pnpm brand:assets` next to `pnpm ui:audit`. `pnpm typecheck && pnpm lint`. Commit `feat(brand): static icons, share card and landing screenshots`.

### Task 4: The landing page

**Files:** Create `components/marketing/landing.tsx`. Modify `app/(marketing)/page.tsx`, `app/(auth)/sign-in/page.tsx`.

**Interfaces — Consumes:** `Logo`, `GoogleSignInButton`, `IconTile`, `GradeBadge`, `/landing/*.webp`. **Produces:** `Landing()` (server component, no props).

- [ ] **Step 1:** build `Landing` from the mocks, with these fixed points:
  - `<main className="bg-wash …">`; desktop: `md:h-dvh md:min-h-[720px]` flex column, top bar (logo `text-[27px]`, links right), then a grid `md:grid-cols-[minmax(0,600px)_1fr]` centred vertically.
  - `h1` three lines with `<br />`, `text-[43px] md:text-[66px] leading-none tracking-[-0.048em] font-[650]`; last line `text-brand-deep dark:text-brand`.
  - Two ledes: phone copy `md:hidden`, desktop copy `hidden md:block`.
  - `FEATURES` array (icon node, title, desktop text, phone text) rendered once as a `<ul>`: one card with dividers below `md`, a 2 × 2 grid without the card from `md`.
  - `PhoneFan`: a `relative` box, `aria-hidden`; each phone is a rounded frame holding two `<img>` (dark and light, `width={584} height={1213}`, `alt=""`), the light one `dark:hidden`, the dark one `hidden dark:block`. Centre phone `loading="eager"`, sides `loading="lazy"`. Sides carry `max-[1099px]:md:hidden`. Phone sizes: 164/138 px wide in a 268 px clipped band below `md`; 292/232 px from `md`.
  - Sign-in block: `GoogleSignInButton` wrapped so it is full width below `md` and `md:w-auto` (pass nothing to the button; wrap it in `md:w-[280px]`), small print below. Below `md` the block is `fixed inset-x-0 bottom-0` over `bg-gradient-to-b from-transparent to-bg` with `pb-[calc(20px+env(safe-area-inset-bottom))]`, and `<main>` gets matching bottom padding (`pb-[176px] md:pb-0`).
  - Links (Data sources, Privacy, Terms): `min-h-11` targets; in the top bar from `md`, under the feature card below `md`.
- [ ] **Step 2:** `app/(marketing)/page.tsx`: keep the session redirect, return `<Landing />`. `app/(auth)/sign-in/page.tsx`: return `<Landing />`, export `metadata = { title: "Sign in", robots: { index: false, follow: true }, alternates: { canonical: "/" } }`.
- [ ] **Step 3:** with `pnpm dev` running, screenshot `/` signed out at 390 and 1280 in dark and light (`pnpm ui:audit --only home,sign-in`) and at 960 and 390 × 667 with a one-off puppeteer snippet; compare with the mocks using the Read tool; fix differences.
- [ ] **Step 4:** `pnpm typecheck && pnpm lint`. Commit `feat(marketing): one-screen landing page for / and /sign-in`.

### Task 5: Metadata, robots and sitemap

**Files:** Modify `app/layout.tsx`, `app/(app)/layout.tsx`, every `app/(app)/**/page.tsx` that is a top-level screen, `proxy.ts` (export `APP_PREFIXES`), `app/(marketing)/*` pages (canonicals). Create `app/robots.ts`, `app/sitemap.ts`, `app/robots.test.ts`.

- [ ] **Step 1: failing test** `app/robots.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { APP_PREFIXES } from "@/proxy";
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
```
  (If importing `proxy.ts` drags in `next/server` in a way vitest cannot load, move `APP_PREFIXES` to `lib/nav/app-prefixes.ts` and import it from both.)
- [ ] **Step 2:** run → FAIL. Implement `robots.ts` (`MetadataRoute.Robots`: `rules: { userAgent: "*", allow: "/", disallow: ["/api/", ...APP_PREFIXES, "/sign-in"] }`, `sitemap: new URL("/sitemap.xml", SITE_URL).href`) and `sitemap.ts` (four entries from `SITE_URL`). Run → PASS.
- [ ] **Step 3:** root `metadata` per spec §5.2 (`metadataBase: SITE_URL`, `title: { default: SITE_TITLE, template: "%s · Santul" }`, description, applicationName, `openGraph`, `twitter`, `alternates: { canonical: "/" }`). Next merges metadata shallowly, so each public page sets its own `alternates.canonical`.
- [ ] **Step 4:** `app/(app)/layout.tsx`: `export const metadata = { robots: { index: false, follow: false } }`. Titles on signed-in pages: Today, Workouts, Progress, Scan, Foods, History, Weight, Me, and "Get started" for onboarding.
- [ ] **Step 5:** `pnpm test && pnpm typecheck && pnpm lint`. Commit `feat(seo): titles, share tags, robots and sitemap`.

### Task 6: Audit, sweep and built-page check

**Files:** Modify `scripts/ui-audit.ts`.

- [ ] **Step 1:** on the `home` and `sign-in` scenarios at 390 px add a `check`: scroll to the bottom; the last feature row's bottom edge must be at or above the pinned bar's top edge; the Google button must be inside the viewport before any scrolling.
- [ ] **Step 2:** `pnpm ui:audit --only home,sign-in,privacy,terms,about-data` → 0 offenders in Dark and Light at both widths.
- [ ] **Step 3: name sweep.** `grep -rIn -iE "eatri8|\bE8\b" app components lib public --include="*.ts" --include="*.tsx" --include="*.svg" --include="*.txt"` shows only the identifiers in Global Constraints and test fixtures.
- [ ] **Step 4:** `pnpm lint && pnpm typecheck && pnpm test`; `pnpm test:int` if the local database is up (report honestly if it is not).
- [ ] **Step 5: built page.** `pnpm build`, `pnpm start` on a spare port, then `curl` `/` and check `<title>`, `description`, canonical, `og:title`, `og:image` (absolute, 200, `image/png`, 1200 × 630), `twitter:card=summary_large_image`, `twitter:image`; `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, `/icon.svg`, `/favicon.ico`, `/apple-icon.png` all 200; `/sign-in` carries `noindex` and canonical `/`.
- [ ] **Step 6:** commit `test(audit): landing pinned-bar check`.
