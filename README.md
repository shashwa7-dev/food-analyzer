<p align="center">
  <a href="https://santul.shashwa7.in/">
    <img src="app/opengraph-image.png" alt="Santul: eat well, train well, stay in balance. Three phone screens showing the day's calories, a scanned food's grade and a week of workouts." width="820">
  </a>
</p>

<h1 align="center">Santul</h1>

<p align="center">
  An open-source food and workout tracker that grades what you eat for <em>your</em> diet, allergies and goals.
</p>

<p align="center">
  <a href="https://santul.shashwa7.in/"><strong>Try it live</strong></a>
  ·
  <a href="#getting-started">Run it locally</a>
  ·
  <a href="CONTRIBUTING.md">Contribute</a>
  ·
  <a href="https://github.com/shashwa7-dev/food-analyzer/issues/new">Report a bug</a>
</p>

<p align="center">
  <a href="https://github.com/shashwa7-dev/food-analyzer/actions/workflows/ci.yml"><img src="https://github.com/shashwa7-dev/food-analyzer/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-a3d944" alt="MIT licence"></a>
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-a3d944" alt="Pull requests welcome"></a>
</p>

Santul is a mobile-first daily food tracker: MyFitnessPal-style logging made effortless by scanning. It tells you how healthy each food is, personalised to your diet, allergies and goals, and suggests a better option sold in your country.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/landing/today-dark.webp">
    <img src="public/landing/today-light.webp" alt="Today: calories left, macros and the day's meals" width="260">
  </picture>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/landing/scan-dark.webp">
    <img src="public/landing/scan-light.webp" alt="A scanned food with its grade, allergy warning and nutrients" width="260">
  </picture>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/landing/workouts-dark.webp">
    <img src="public/landing/workouts-light.webp" alt="Workouts: weekly goal, week strip and monthly calendar" width="260">
  </picture>
</p>

## What it does

- **Scan instead of typing.** Barcode lookups are free; a photo of a label, pack or meal is read by AI (20 a month on Basic).
- **A grade for every food.** Graded for your goal, with flags for your diet and allergies, and the reasons behind the grade.
- **A catalogue that knows Indian food.** About 14,800 foods from INDB, USDA FNDDS and Open Food Facts India.
- **Food diary.** Meals, a date switcher, daily calorie and macro targets, and limits for sodium, saturated fat and sugar.
- **Workouts and weight.** Log sessions, follow a weekly goal, and see calories burned next to calories eaten.
- **Progress.** Weekly and monthly trends, on-target days and logging streaks.
- **Your data stays yours.** Google sign-in, CSV export, account deletion, no ads and no data sales.

## Built with

[Next.js 16](https://nextjs.org) (App Router) and React 19 · TypeScript · Tailwind CSS 4 and [Base UI](https://base-ui.com) · PostgreSQL with [Drizzle ORM](https://orm.drizzle.team) · [Better Auth](https://www.better-auth.com) · [Vercel AI SDK](https://ai-sdk.dev) with Gemini · Cloudflare R2 · Vitest

> The product was renamed from EATRi8 to Santul in October 2026. Internal identifiers (the `eatri8-theme` cookie, browser storage keys, database, package and CI names) still say `eatri8` on purpose: renaming them would reset people's theme and lose in-progress workouts.

## Getting started

You can have Santul running locally in a few minutes. Barcode scanning, the food catalogue, the diary and workouts need only Postgres and a Google OAuth client; AI photo scans also need a Gemini API key (see [Scanning](#scanning-m2)).

### Prerequisites

- Node.js 24 (`package.json` `engines` pins `24.x`, which is also what Vercel builds with)
- pnpm ≥ 10 (`corepack enable` or `npm i -g pnpm`)
- Docker Desktop (for local Postgres)

### Local setup

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

- `BETTER_AUTH_SECRET` — generate with `openssl rand -base64 32`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — create an OAuth 2.0 Web client in Google Cloud Console and add `http://localhost:3000/api/auth/callback/google` as an authorised redirect URI
- the rest of `.env.example` already has working local defaults

Then:

```bash
pnpm install
pnpm db:up          # starts local Postgres 17 in Docker
pnpm db:migrate      # applies schema migrations
pnpm seed:foods      # seeds the food catalogue (~14.8k foods, idempotent)
pnpm dev
```

The app runs at `http://localhost:3000`.

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Start the dev server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | ESLint, zero warnings allowed |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Unit tests (`vitest`, offline) |
| `pnpm test:int` | Integration tests against local Postgres (`vitest`, needs `pnpm db:up`) |
| `pnpm db:up` | Start local Postgres 17 via Docker Compose |
| `pnpm db:generate` | Generate a Drizzle migration from schema changes |
| `pnpm db:migrate` | Apply Drizzle migrations. Always use this, never `drizzle-kit push`: the `daily_ai_cost` view (migration `0003`) isn't declared in `schema.ts`, so `push` would drop it |
| `pnpm fetch:sources` | Download/refresh raw catalogue sources (INDB, USDA FNDDS, OFF India) |
| `pnpm seed:foods` | Normalise and seed the food catalogue into Postgres (idempotent on `(source, sourceRef)`) |
| `pnpm regrade` | Recompute stored food grades after a `gradeVersion` bump |
| `pnpm search:smoke` | Manual smoke check of search ranking against a fixed query list |
| `pnpm scan:try <image...>` | Manual smoke test of the scanning engine against 1–3 real image files (needs `GOOGLE_GENERATIVE_AI_API_KEY`) |
| `pnpm seed:demo` | Dev only: create/refresh the demo account and write its session cookie (see [Demo data and screenshots](#demo-data-and-screenshots-dev-only)) |
| `pnpm shot <path>` | Dev only: screenshot one page as the demo user |
| `pnpm ui:audit` | Dev only: the UI audit (no-wrap, lime-as-text, contrast, tap targets) over every screen; see [UI](#ui) |
| `pnpm eval [--models=fast,strong]` | Scanning eval harness against a local fixture suite (needs `GOOGLE_GENERATIVE_AI_API_KEY` and fixtures — see [`eval/README.md`](eval/README.md)) |

## Environment variables

| Var | Required | Source |
|---|---|---|
| `DATABASE_URL` | yes | Local: `postgres://eatri8:eatri8@localhost:5432/eatri8` from `pnpm db:up`. Hosted (Neon): the pooled connection string from the Neon dashboard. |
| `BETTER_AUTH_SECRET` | yes | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | yes | `http://localhost:3000` locally, your deployed URL in prod |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | yes | Google Cloud Console → OAuth 2.0 Web client; redirect URI `{BETTER_AUTH_URL}/api/auth/callback/google` |
| `CREDIT_TOMBSTONE_PEPPER` | no | Keys the email HMAC kept when an account is deleted (so deleting and signing up again can't reset AI-scan usage). Falls back to `BETTER_AUTH_SECRET`; set a dedicated value (≥ 16 chars, `openssl rand -base64 32`) so rotating the auth secret doesn't orphan tombstones. In production the fallback logs a one-time warning. |
| `OFF_CONTACT_EMAIL` | no | Contact email sent in the `User-Agent` header on Open Food Facts requests (`Santul/2.0 (<contact>)`) |
| `TEST_DATABASE_URL` | yes, for `pnpm test:int` | Points at a separate local database, e.g. `postgres://eatri8:eatri8@localhost:5432/eatri8_test` |

Server code runs in Vercel's Singapore region (`sin1`, set in `vercel.json`) because the Neon database is in `ap-southeast-1`, also Singapore. Every page makes several database round trips, so the two must stay side by side: if the database ever moves, change `regions` to match.

All env vars are validated at boot through `lib/env.ts` (zod; an empty string counts as unset). There are no `NEXT_PUBLIC_` secrets.

## Scanning (M2)

Scanning (barcode and AI-assisted photo extraction) is implemented from M2 onward.

### Environment variables

| Var | Required | Source |
|---|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | For AI-assisted (photo) scans | Google AI Studio API key. Set it in `.env.local`, which is git-ignored (see `.gitignore`'s `.env*` entry) — never commit a real key anywhere else. Without it, barcode scans still work (free, no model call), but photo scans return `503 SERVICE_BUSY`. |
| `MODEL_FAST` | no | Model id for the (only) tier the engine currently calls. Defaults to `gemini-3.5-flash-lite` (`lib/engine/models.ts`). |
| `MODEL_STRONG` | no | Reserved for a future strong-tier pass; not yet called by the engine. Defaults to `gemini-3.5-flash`. |
| `DAILY_AI_SCAN_CAP` | no | Global cap on model-calling scans per UTC day, across all users combined. Defaults to `300`. Once hit, new AI scans get `503 SERVICE_BUSY` until the day rolls over (`lib/scans/deps.ts`, `lib/rate-limit.ts`). |
| `PRO_GATES_ENFORCED` | no | Launch switch for the Pro-only features (200 AI scans a month, Progress month view, workout insights (Month stats, trends, top exercises, how often), CSV data export, custom daily targets; `lib/credits/plan-features.ts`). Off by default, so everything stays open until Pro launches. Set `true` (or `1`) to enforce: Basic users get a "Pro" lock on those features and an upgrade sheet that joins the waitlist; `GET /api/v1/progress?range=month`, `GET /api/v1/fitness/stats?range=month` and `GET /api/v1/export` return `403 PRO_REQUIRED` (the Workouts page quietly falls back to Week and shows one blurred Pro preview in place of the insight cards); saving custom targets on Basic is rejected. Reads are gated too: a Basic user's stored custom targets are ignored and their goal preset applies everywhere (Today, Progress, scan grading), with a one-time notice on Today and Me. The stored overrides are kept, so they come back on upgrading. Try Pro locally with `pnpm plan:set <email> pro`. |

### Credits

- Each plan gets a monthly allowance of AI-assisted (photo) scans: Basic 20/month, Pro 200/month (`lib/credits/plans.ts`). The allowance resets lazily — on the first read or spend after the UTC month rolls over, not on a schedule (`lib/credits/ledger.ts`).
- A barcode scan (code found in our catalogue or Open Food Facts) costs 0 credits — only AI-assisted scans are charged, 1 credit each.
- A charged scan that fails is refunded automatically, atomically with the failure write (`failScanTx` in `lib/scans/service.ts`).
- Deleting the account keeps a tombstone — an HMAC of the normalised email with this month's used scans and today's count, no plain PII (`lib/credits/tombstone.ts`) — so signing up again with the same email starts from the same usage. A tombstone is kept only for its month: once that month ends it is deleted (`pruneTombstones`), on the next account deletion or sign-up.
- Independent of credits, each user is capped at 25 AI-assisted scans per UTC day (`DAILY_AI_SCANS_PER_USER` in `lib/rate-limit.ts`); refunded scans still count toward it, so a refund can't be looped for free scans.

### Scan photos on Cloudflare R2

Each successful AI photo scan keeps **one** image: a 480 px (long edge) WebP made from the first photo, about 40–50 KB, rotated upright with no metadata (no EXIF, no GPS). It is kept until the scan is deleted. Originals and the other photos are never stored. Nothing is uploaded for a failed scan: the upload happens only after the scan has succeeded (`storeScanImage` in `lib/scans/photo-storage.ts`, processing in `lib/scans/photos.ts` with `sharp`), in the scan's background job, and can never fail, change or delay the scan or its charge. URLs are presigned for 10 minutes. Deleting a scan deletes its image (best effort, after the response); deleting the account deletes the user's whole `thumb/u/{userId}/` prefix first. Barcode scans have no image. There is no lifecycle or expiry rule.

Storage is **off unless all four vars are set**; off, the app behaves exactly as without it (no uploads, `imageUrl: null`).

| Var | Required | Source |
|---|---|---|
| `R2_ACCOUNT_ID` | for photo storage | Cloudflare dashboard → R2 → Account details (the account ID in `https://<id>.r2.cloudflarestorage.com`) |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | for photo storage | R2 → Manage API tokens → Create API token: **Object Read & Write**, applied to **this bucket only**. Shown once. |
| `R2_BUCKET` | for photo storage | The bucket's name, e.g. `eatri8-photos` |

Key: `thumb/u/{userId}/{scanId}.webp` (`lib/storage/keys.ts`). The bucket stays private (no public access, no custom domain): the app only hands out presigned GET URLs.

Set up once per bucket, in three steps: (1) create the bucket (R2 → Create bucket, location Automatic, Standard storage class); (2) create the bucket-scoped **Object Read & Write** token above; (3) put the four env vars in `.env.local` (and the deployment's env).

A bucket used with an earlier build of this branch may hold old objects under `display/`. Delete that prefix once (Cloudflare dashboard → the bucket → select the `display/` folder → Delete), and remove the `eatri8-display-30d` lifecycle rule if it was applied. No released version ever wrote there.

### Before launch

- Run `pnpm db:migrate` against the production database before each deploy that adds migrations (this release: 0008–0012). Nothing runs them automatically, and the new code reads columns they add, so an unmigrated database returns a 500 on every signed-in page. Migrating first is safe for the build already live.
- Scan image storage is on only when all four `R2_*` variables are set; the server logs a warning when some but not all are.
- Rotate the old Gemini key: `NEXT_PUBLIC_GEMINI_API_KEY` is still in `master` history (added in `3afd1c4`, removed in `4d2b34c`). Revoke it in Google AI Studio and make sure `GOOGLE_GENERATIVE_AI_API_KEY` is a different, server-only key.

### Scanning eval harness

`pnpm eval` runs the extraction engine against a local fixture suite and reports per-field accuracy, schema-failure rate, triage accuracy, latency and cost. It needs `GOOGLE_GENERATIVE_AI_API_KEY` and fixtures under `eval/fixtures/`; with either missing it prints `skipped: ...` and exits 0. See [`eval/README.md`](eval/README.md) for how to add fixtures.

### Trying a single scan

`pnpm scan:try <image...>` runs one real extraction against 1–3 image files and prints the result, usage and cost — a quick way to check a single label/photo without the eval harness.

### Scan photos and what is stored

Scan photos are held in memory for the model call. The photos are never written to disk. Since Phase 2, a successful AI scan also keeps one small optimised image of its first photo in a private R2 bucket (see [Scan photos on Cloudflare R2](#scan-photos-on-cloudflare-r2)); without R2 configured, nothing is stored.

### Barcode decoding on /scan

The scan screen decodes EAN-13 / EAN-8 / UPC-A barcodes with the browser's `BarcodeDetector` where it
supports EAN-13 (Chrome on Android/macOS), and otherwise lazily loads [`zxing-wasm`](https://github.com/Sec-ant/zxing-wasm)
(only on `/scan`). For M2 the zxing wasm binary is fetched from zxing-wasm's default CDN
(`fastly.jsdelivr.net/npm/zxing-wasm@<version>/dist/reader/zxing_reader.wasm`). No Content-Security-Policy is
configured yet; when one is added, allow that origin in `connect-src` (and `script-src 'wasm-unsafe-eval'`),
or self-host the wasm via `prepareZXingModule({ overrides: { locateFile } })`.

## Workouts

`/workouts` is the fitness hub. On first visit it asks for a weekly goal, goal weight and height ("Set up your training", skippable); until the first workout it shows the six ways to start a session; after that it has the weekly goal and next preset in your rotation, a week strip, weekly stats (sessions, volume, time, calories burned), body weight with its 30-day trend and the full paged history. Pro adds workout insights: a Week | Month switch, a Calendar | Volume trends card (monthly day-type calendar, 8-week volume), top exercises and how often you train each day type. With `PRO_GATES_ENFORCED` on, Basic users see one blurred preview with a "See Pro" button instead.

| Route | Purpose |
| --- | --- |
| `/workouts` | The hub (setup form, empty state or full hub; `?range=month` is Pro) |
| `GET /api/v1/fitness/stats` | Stats for `?range=week\|month` (month and the insight fields are Pro) |
| `GET /api/v1/workouts/history` | Paged workout history (`?cursor=`) |
| `POST /api/v1/me/fitness/setup` | Saves the first-visit setup (goal, goal weight, height) or skips it |

## Demo data and screenshots (dev only)

Sign-in is Google-only, so headless checks use a seeded demo account instead:

```bash
pnpm seed:demo                                # demo@eatri8.local ("Aarav Kapoor"), 10 days of diary, 4 scans, 18/20 credits,
                                              # this week's Push/Pull/Legs + 2 walks, 30 days of weight (goal 70 kg, 5 days a week)
pnpm shot /today --w 390                      # → .superpowers/shots/today-390-light.png
pnpm shot /history --w 1280 --dark --full     # desktop, dark, full page; --out file.png to pick the path
```

`seed:demo` is idempotent (re-run it any time; it rebuilds the diary, workouts and weight relative to today in IST) and refuses to run with `NODE_ENV=production` or a non-localhost `DATABASE_URL`. It needs `pnpm seed:foods` first. It seeds 10 weeks of workouts (one rest week, so the streak breaks) and writes a 30-day Better Auth session cookie to `.superpowers/demo-cookie.txt` (git-ignored). It also creates two more local users, touching no others: `fresh@demo.local` (no fitness setup, so `/workouts` shows the setup form; `.superpowers/demo-fresh-cookie.txt`) and `starter@demo.local` (set up, 68 kg, no workouts, so `/workouts` shows the empty hub; `.superpowers/demo-starter-cookie.txt`) and checks it against `/api/v1/me` when `pnpm dev` is running. `pnpm shot` needs the dev server and Google Chrome in `/Applications`.

## UI

The C1 "Lime & Ink" design (spec: `docs/superpowers/specs/2026-10-07-redesign-c1-design.md`, mock: `docs/design/mock-c1.html`).

- **Tokens** live in `app/globals.css`: the light palette on `:root`, the dark palette in two identical blocks (`[data-theme="dark"]` and `[data-theme="system"]` under `prefers-color-scheme: dark`; `app/globals-css.test.ts` keeps them in step), mapped to Tailwind colours in `@theme inline`. Components use token colours only (`text-ink`, `bg-brand`, `text-protein-ink`…), never hex values or Tailwind palette colours. Appearance (Dark, the default / Light / System) is the `eatri8-theme` cookie, applied before paint by the head script in `lib/theme.ts`.
- **Icons** are lucide (`lucide-react`) on buttons, rows, tiles, chips and flags. They are decorative: `aria-hidden`, with the text label carrying the meaning.
- **Buttons never wrap.** Every button, chip, tab and pill is `whitespace-nowrap`; if a label doesn't fit at 360 px, shorten it or let an icon carry it.
- **Lime is a fill, never text.** Text accents use `--brand-deep`; text on `--brand-soft` uses `--on-brand-soft`; text on lime uses `--brand-ink`. Grade letters use `--on-grade` / `--on-grade-light`, and macro numbers `--protein-ink` / `--carbs-ink` / `--fat-ink`, so all text meets WCAG AA.
- **Tap targets are at least 44 × 44 px** (the element itself, a `::before`/`::after` hit area, or a parent that is the hit area).

`pnpm ui:audit` checks those rules in headless Chrome on every screen and the main interactive states (add-food and edit-entry sheets, date picker, delete confirm, the Today energy strip, the Workouts page in each of its states (setup, empty, week, month, Volume tab, Pro-locked), `/weight` and its log sheet, the Me Fitness sheet), at 390 × 844 and 1280 × 800, in Dark and Light (plus System under both OS schemes on `/today`). It exits 1 on any offender and saves screenshots to `docs/design/qa/` (git-ignored); see [`docs/design/qa/README.md`](docs/design/qa/README.md) for the page list and options. It is read-only (it never saves, deletes or completes onboarding) and needs `pnpm dev` and `pnpm seed:demo`:

`pnpm brand:assets` rewrites the static brand files that are committed with the app: the icons (`app/icon.svg`, `app/favicon.ico`, `app/apple-icon.png`, `public/icons/`), the share card (`app/opengraph-image.png` and `app/twitter-image.png`, 1200 × 630, with their alt text) and the home page's phone screenshots (`public/landing/`). The screenshots are cut from `pnpm ui:audit`'s 390 px shots of Today, a label scan and Workouts, so run the audit first; re-run it whenever those screens change. It needs Google Chrome in `/Applications` and the network once (for the Geist font). The mark itself is drawn in `scripts/brand/mark.ts` and `components/brand/logo.tsx`.

```bash
pnpm seed:demo && pnpm ui:audit
pnpm ui:audit --only today,foods-dal-sheet --w 390 --theme light   # a subset
```

## Contributing

Contributions are welcome: bug reports, food data fixes, design polish and features. [CONTRIBUTING.md](CONTRIBUTING.md) has the full rules; the short version:

1. **Open an issue first** for anything bigger than a small fix, so we can agree on the approach before you write code.
2. **Branch from `master`** and keep each pull request to one change.
3. **Make the checks pass**: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm ui:audit` if you touched the UI.
4. **Never commit secrets.** Keys live in `.env.local`, which is git-ignored.

Found a security problem? Please don't open a public issue; see [Reporting a security issue](CONTRIBUTING.md#reporting-a-security-issue).

## Data attribution

The food catalogue is built from:

- **Indian Nutrient Databank (INDB)** — CC BY 4.0
- **USDA FoodData Central (FNDDS)** — CC0
- **Open Food Facts (India)** — ODbL

Full attribution is shown in-app at `/about/data`.

## Further reading

- Product & system design spec: [`docs/superpowers/specs/2026-10-06-eatri8-v2-design.md`](docs/superpowers/specs/2026-10-06-eatri8-v2-design.md)
- M1 implementation plan: [`docs/superpowers/plans/2026-10-06-m1-tracker.md`](docs/superpowers/plans/2026-10-06-m1-tracker.md)

## Licence

The code is released under the [MIT licence](LICENSE). The food data under `data/sources/` is not covered by it: each dataset keeps its own licence (see [Data attribution](#data-attribution) and [`data/sources/ATTRIBUTION.md`](data/sources/ATTRIBUTION.md)).
