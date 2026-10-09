# Santul: new name, logo, home page and share metadata

**Status:** implemented (see the "As built" notes in §4 and §5) · **Date:** 2026-10-09
**Branch:** `santul-rebrand`, from `master` at `f5991a9` (Phase 2 merged)
**Visual source of truth:** the approved companion mocks in `.superpowers/brainstorm/21347-1791554966/content/` (git-ignored): `santul-split-plate-refine.html` (logo), `landing-one-screen-v3.html` (desktop home), `mobile-and-og.html` (phone home option A, share card).

## 1. Goal

The app now tracks food, workouts and weight, and "EATRi8" only says food and cannot be spelled from hearing it. Rename the product to **Santul** ("balance"), give it a real logo, replace the bare home page with one that explains the app, and add the metadata that makes links to it preview properly.

**Success means:**
- No page, title, icon or exported file a person sees says "EATRi8" or "E8".
- The signed-out home page matches the approved mocks at 390 px and 1280 px wide, in Dark and Light.
- A link to the site pasted into WhatsApp, X or Slack shows the share card, the title and the description.
- No button wraps onto two lines, and all existing tests and the UI audit pass.

## 2. Out of scope

| Item | Why |
|---|---|
| Renaming hidden identifiers | Agreed: nobody sees them, and renaming would reset users' theme and lose in-progress workouts. Unchanged: `eatri8-theme` cookie, `eatri8-workout-draft:*`, `eatri8-trends-tab` and `eatri8:in-app-nav` storage keys, the `eatri8-workout-draft` event, database names, the `package.json` name, CI and docker-compose names. |
| Buying or connecting a domain, renaming the Vercel project | The user's to do. The site address is a setting (§5.1). |
| Pricing or Pro content on the home page | Pro has not launched. |
| Changes to signed-in screens | Only the logo and page titles change there. |
| Structured data (JSON-LD), per-page share images | Not needed for four public pages. |
| Older specs, plans and mocks under `docs/` | Historical records; they keep the old name. |

## 3. Name and logo

### 3.1 The mark

"The split plate": one disc cut into two equal halves that have slipped past each other, the cut tilted 24° clockwise. On a 120 × 120 canvas:

```svg
<rect width="120" height="120" rx="28" fill="#12150F"/>
<g transform="rotate(24 60 60)">
  <path d="M57 23A31 31 0 0 0 57 85Z" fill="#A6D84A"/>
  <path d="M63 35A31 31 0 0 1 63 97Z" fill="#EDF1E6"/>
</g>
```

- The tile is always ink (`#12150F`), the left half always lime (`#A6D84A`), the right half always off-white (`#EDF1E6`), in both themes. These are fixed brand colours, not theme tokens.
- On a dark background the tile gets a 1 px inner hairline (`rgb(255 255 255 / .16)`) so its edge shows.

### 3.2 The wordmark

Lowercase `santul`, Geist 700, letter-spacing −0.045em, in `--ink`. In the lockup the mark sits to the left at 1.25× the text's font size with a 0.36em gap.

### 3.3 Components

`components/brand/logo.tsx` is rewritten:
- `LogoMark({ className })`: the inline SVG mark, sized by a `size-*` class, `aria-hidden`.
- `Logo({ className })`: the lockup (mark + wordmark), sized by a `text-*` class as today, with a screen-reader "Santul". Existing call sites (`app-nav`, `account-footer`, `marketing-page`, `dialog`, home, sign-in) keep working without changes to their props.

In running text the name is written "Santul" (capitalised); only the wordmark is lowercase.

### 3.4 Visible renames

| Where | Change |
|---|---|
| `app/layout.tsx`, `app/manifest.ts` | Name, short name, application name → Santul (see §5) |
| Privacy, terms, data sources pages | Body copy and titles |
| `components/marketing/marketing-page.tsx` | `aria-label="Santul home"` |
| `components/scan/scan-flow.tsx` | "Couldn't reach Santul. Check your connection and try again." |
| `app/api/v1/export/route.ts` | File name `santul-{what}-{date}.csv`; its integration test updated |
| `lib/engine/off.ts` | Open Food Facts `User-Agent` → `Santul/2.0 (…)`; its test updated |
| `README.md` | Product name throughout; identifiers from §2 left as they are, with one sentence saying why |

## 4. Home and sign-in page

### 4.1 One page, two routes

A new server component `components/marketing/landing.tsx` renders the page. `app/(marketing)/page.tsx` (after its existing signed-in redirect to `/today`) and `app/(auth)/sign-in/page.tsx` both render it. `/sign-in` sets `robots: noindex` and a canonical of `/` so the two do not compete in search.

### 4.2 Content

| Part | Text |
|---|---|
| Headline (`h1`, three fixed lines) | Eat well. / Train well. / **Stay in balance.** (last line in `--brand`) |
| Lede, desktop | Santul keeps your meals, workouts and weight in one place, so you can see what you've eaten against what you've burned. |
| Lede, phone | Your meals, workouts and weight in one place. |
| Feature 1 (bowl icon) | **Log meals in real portions** · 14,800 foods, with Indian dishes by the katori, roti or glass. |
| Feature 2 (scan icon) | **Scan any pack** · Barcodes are free. Photograph a label and it's read for you. |
| Feature 3 (grade A badge) | **Get an honest A–E grade** · Graded for your diet and goals, with the reasons spelled out. |
| Feature 4 (dumbbell icon) | **Track workouts and weight** · Log a session or a walk and your day's balance updates. |
| Button | The existing `GoogleSignInButton`, unchanged |
| Small print, under the button | Free to use. By continuing you agree to the terms and privacy policy. (both linked) |
| Links | Data sources · Privacy · Terms |

Icons are lucide (`Soup`, `ScanLine`, `Dumbbell`) in `IconTile tone="brand"`, plus the existing `GradeBadge`, as on today's home page. The headline's last line uses `--brand-deep` in both themes: the app's lime-for-text token (the UI audit forbids `--brand` itself as text).

### 4.3 Layout

**From 900 px (the `md` breakpoint):** one screen, no scrolling at 1280 × 800.
- Top bar: logo left; Data sources, Privacy, Terms right.
- Two columns. Left (about 600 px): headline at 66 px, lede, the four features in a 2 × 2 grid, the button at its natural width, the small print directly below it.
- Right: three phone frames. Today in front and centred (292 px wide); the scan result behind it on the left and Workouts behind on the right (232 px wide, rotated −7° and +7°).
- Below 1270 px the side phones are hidden so the phones never collide with the text. (As built: the spec first said about 1100 px, but the three-phone fan needs 540 px beside a 570 px text column.) Between 900 and 1269 px the headline is 58 px.

**Below 900 px:** a single column that scrolls.
- Logo, headline at 43 px, phone lede.
- The same three phones, smaller (164 px and 138 px wide), in a 268 px tall band that clips their lower halves.
- The four features in one card, one per row.
- The links.
- The button and small print pinned to the bottom of the viewport over a fade to `--bg`, respecting the bottom safe-area inset; the page's bottom padding leaves room so the last row is never hidden behind it.

The pinned bar is the page's only fixed element. The phone frames are decorative: `aria-hidden`, empty `alt`.

### 4.4 Screenshots

Six images in `public/landing/`: `today`, `scan`, `workouts`, each in `-dark` and `-light`, as WebP.
- Source: the UI audit's 390 px screenshots (`today`, `scan-label`, `workouts` in `docs/design/qa/`, which is git-ignored and produced from demo data).
- A new script, `pnpm brand:assets` (§5.3), crops each to the top 780 × 1620 px and writes it 584 px wide with `sharp`. Target: under 60 KB each.
- Both themes' images are in the markup; CSS shows the one for the active theme (the `dark:` variant), so there is no flash and no client JavaScript. Images have explicit width and height. All of them load lazily, so the hidden theme's file is never fetched.

## 5. Titles, descriptions and share cards

### 5.1 Site address

New `lib/site.ts` exports `SITE_URL` and the shared name, title and description strings. `SITE_URL` is the first of:
1. `NEXT_PUBLIC_SITE_URL`, if set
2. `https://${VERCEL_PROJECT_PRODUCTION_URL}`, which Vercel sets
3. `http://localhost:3000`

It is validated as a URL at load, with a unit test for the three cases. `.env.example` and the README's variable table gain `NEXT_PUBLIC_SITE_URL` (optional). Today it resolves to `https://eatri8-ai.vercel.app` in production.

### 5.2 Metadata

Root `app/layout.tsx`:

| Field | Value |
|---|---|
| `metadataBase` | `SITE_URL` |
| `title.default` | Santul: eat well, train well, stay in balance |
| `title.template` | `%s · Santul` |
| `description` | Track meals, workouts and weight in one place. Log Indian dishes in real portions and scan any pack for an honest A–E grade. |
| `applicationName` | Santul |
| `openGraph` | `type: website`, `siteName: Santul`, `locale: en_IN`, title and description as above (no `url`: every page inherits this block) |
| `twitter` | `card: summary_large_image`, title and description as above |
| `alternates.canonical` | `/` on the home page; each public page sets its own |

- Public pages set a short title that goes through the template: "Privacy", "Terms", "Data sources".
- `app/(app)/layout.tsx` sets `robots: { index: false, follow: false }`, and each signed-in page sets a short title ("Today", "Workouts", "Progress", "Scan", "Foods", "History", "Weight", "Me", "Get started" for onboarding).
- `app/robots.ts`: allow `/`, disallow `/api/` and the signed-in prefixes (`lib/nav/app-prefixes.ts`, shared with `proxy.ts`), and point to the sitemap.
- `app/sitemap.ts`: `/`, `/privacy`, `/terms`, `/about/data`.

### 5.3 Images and icons

All are static files, rendered once by `pnpm brand:assets` and committed, so builds do not depend on an image renderer and the share card is pixel-identical to the mock.

`scripts/brand-assets.ts` uses the repo's existing headless-Chrome helper (`scripts/lib/browser.ts`) and `sharp`:

| Output | Size | Notes |
|---|---|---|
| `app/opengraph-image.png` + `opengraph-image.alt.txt` | 1200 × 630 | The approved card: lockup top left, headline, "Meals, workouts and weight in one place.", three dark-theme phones on the right running off the bottom edge. Rendered from an HTML template in `scripts/brand/`. Under 400 KB. |
| `app/twitter-image.png` + `twitter-image.alt.txt` | 1200 × 630 | The same image. |
| `app/icon.svg` | vector | The mark from §3.1. |
| `app/favicon.ico` | 32 × 32 | Replaces the current file. |
| `app/apple-icon.png` | 180 × 180 | The mark on a full-bleed ink square (iOS rounds the corners itself). |
| `public/icons/icon-192.png`, `icon-512.png` | | The mark, for the manifest. |
| `public/icons/icon-maskable-512.png` | | The mark at 70% on a full-bleed ink square, so Android's mask never clips it. |
| `public/landing/*.webp` | | §4.4 |

Alt text for both share images: "Santul: eat well, train well, stay in balance. Three phone screens showing the day's calories, a scanned food's grade and a week of workouts."

`app/icon.tsx` and `app/apple-icon.tsx` are deleted. `app/manifest.ts` lists the 192, 512 and maskable icons; name and short name are "Santul"; the rest is unchanged.

The script needs the UI audit's screenshots to exist and exits with a clear message if they do not. It is documented in the README beside `pnpm ui:audit`.

## 6. Testing and checks

- **Unit:** `lib/site.ts` (address fallbacks); `app/robots.ts` and `app/sitemap.ts` (expected entries; the disallow list covers every prefix in `proxy.ts`).
- **Updated tests:** export file name, Open Food Facts `User-Agent`.
- **UI audit:** `home` and `sign-in` at 390 × 844 and 1280 × 800, in Dark and Light, with its existing rules (no wrapped buttons, contrast, tap targets). Add a check that the pinned bar does not cover the last feature row once scrolled to the end.
- **Built-page check:** after `pnpm build`, load `/` and confirm the title, description, canonical, `og:*` and `twitter:*` tags, that `og:image` is an absolute URL on `SITE_URL` returning a 1200 × 630 PNG, and that `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest` and `/icon.svg` respond.
- **Name sweep:** a search for "EATRi8" and "E8" in `app/`, `components/`, `lib/` and `public/` finds only the identifiers listed in §2.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:int` pass.

## 7. Follow-ups for the user

- Choose and connect a domain (or rename the Vercel project), then set `NEXT_PUBLIC_SITE_URL`.
- The Google sign-in consent screen shows the app name set in Google Cloud Console; change it to Santul there.
- Domain availability was checked by DNS only, and trademarks and app stores were not checked.
