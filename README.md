# EATRi8

EATRi8 is a mobile-first daily food tracker — MyFitnessPal-style logging made effortless by scanning — that tells you how healthy each food is, personalised to your diet, allergies and goals, and suggests a better option sold in your country. M1 shipped the tracker core: Google sign-in, onboarding, a seeded food catalogue (INDB + USDA FNDDS + Open Food Facts India, ~14.8k foods), search, food log, a Today view with a date switcher, and account settings. M2 adds scanning: free barcode lookups and AI-assisted photo extraction with a monthly credit allowance (see [Scanning](#scanning-m2)).

## Prerequisites

- Node.js ≥ 22
- pnpm ≥ 10 (`corepack enable` or `npm i -g pnpm`)
- Docker Desktop (for local Postgres)

## Local setup

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
| `pnpm eval [--models=fast,strong]` | Scanning eval harness against a local fixture suite (needs `GOOGLE_GENERATIVE_AI_API_KEY` and fixtures — see [`eval/README.md`](eval/README.md)) |

## Environment variables

| Var | Required | Source |
|---|---|---|
| `DATABASE_URL` | yes | Local: `postgres://eatri8:eatri8@localhost:5432/eatri8` from `pnpm db:up`. Hosted (Neon): the pooled connection string from the Neon dashboard. |
| `BETTER_AUTH_SECRET` | yes | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | yes | `http://localhost:3000` locally, your deployed URL in prod |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | yes | Google Cloud Console → OAuth 2.0 Web client; redirect URI `{BETTER_AUTH_URL}/api/auth/callback/google` |
| `CREDIT_TOMBSTONE_PEPPER` | no | Keys the email HMAC kept when an account is deleted (so deleting and signing up again can't reset AI-scan usage). Falls back to `BETTER_AUTH_SECRET`; set a dedicated value (≥ 16 chars, `openssl rand -base64 32`) so rotating the auth secret doesn't orphan tombstones. |
| `OFF_CONTACT_EMAIL` | no | Contact email sent in the `User-Agent` header on Open Food Facts requests (`EATRi8/2.0 (<contact>)`) |
| `TEST_DATABASE_URL` | yes, for `pnpm test:int` | Points at a separate local database, e.g. `postgres://eatri8:eatri8@localhost:5432/eatri8_test` |

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

### Credits

- Each plan gets a monthly allowance of AI-assisted (photo) scans: Basic 20/month, Pro 200/month (`lib/credits/plans.ts`). The allowance resets lazily — on the first read or spend after the UTC month rolls over, not on a schedule (`lib/credits/ledger.ts`).
- A barcode scan (code found in our catalogue or Open Food Facts) costs 0 credits — only AI-assisted scans are charged, 1 credit each.
- A charged scan that fails is refunded automatically, atomically with the failure write (`failScanTx` in `lib/scans/service.ts`).
- Deleting the account keeps a tombstone — an HMAC of the normalised email with this month's used scans and today's count, no plain PII (`lib/credits/tombstone.ts`) — so signing up again with the same email starts from the same usage.
- Independent of credits, each user is capped at 25 AI-assisted scans per UTC day (`DAILY_AI_SCANS_PER_USER` in `lib/rate-limit.ts`); refunded scans still count toward it, so a refund can't be looped for free scans.

### Before launch

- Rotate the old Gemini key: `NEXT_PUBLIC_GEMINI_API_KEY` is still in `master` history (added in `3afd1c4`, removed in `4d2b34c`). Revoke it in Google AI Studio and make sure `GOOGLE_GENERATIVE_AI_API_KEY` is a different, server-only key.

### Scanning eval harness

`pnpm eval` runs the extraction engine against a local fixture suite and reports per-field accuracy, schema-failure rate, triage accuracy, latency and cost. It needs `GOOGLE_GENERATIVE_AI_API_KEY` and fixtures under `eval/fixtures/`; with either missing it prints `skipped: ...` and exits 0. See [`eval/README.md`](eval/README.md) for how to add fixtures.

### Trying a single scan

`pnpm scan:try <image...>` runs one real extraction against 1–3 image files and prints the result, usage and cost — a quick way to check a single label/photo without the eval harness.

### No image storage

Scan photos are held in memory only for the single model call and then discarded — they are never written to disk or any bucket (`lib/engine/schema.ts`). R2/thumbnail storage is not part of M2.

### Barcode decoding on /scan

The scan screen decodes EAN-13 / EAN-8 / UPC-A barcodes with the browser's `BarcodeDetector` where it
supports EAN-13 (Chrome on Android/macOS), and otherwise lazily loads [`zxing-wasm`](https://github.com/Sec-ant/zxing-wasm)
(only on `/scan`). For M2 the zxing wasm binary is fetched from zxing-wasm's default CDN
(`fastly.jsdelivr.net/npm/zxing-wasm@<version>/dist/reader/zxing_reader.wasm`). No Content-Security-Policy is
configured yet; when one is added, allow that origin in `connect-src` (and `script-src 'wasm-unsafe-eval'`),
or self-host the wasm via `prepareZXingModule({ overrides: { locateFile } })`.

## Demo data and screenshots (dev only)

Sign-in is Google-only, so headless checks use a seeded demo account instead:

```bash
pnpm seed:demo                                # demo@eatri8.local ("Aarav Kapoor"), 10 days of diary, 4 scans, 18/20 credits
pnpm shot /today --w 390                      # → .superpowers/shots/today-390-light.png
pnpm shot /history --w 1280 --dark --full     # desktop, dark, full page; --out file.png to pick the path
```

`seed:demo` is idempotent (re-run it any time; it rebuilds the diary relative to today in IST) and refuses to run with `NODE_ENV=production` or a non-localhost `DATABASE_URL`. It needs `pnpm seed:foods` first. It writes a 30-day Better Auth session cookie to `.superpowers/demo-cookie.txt` (git-ignored) and checks it against `/api/v1/me` when `pnpm dev` is running. `pnpm shot` needs the dev server and Google Chrome in `/Applications`.

## Data attribution

The food catalogue is built from:

- **Indian Nutrient Databank (INDB)** — CC BY 4.0
- **USDA FoodData Central (FNDDS)** — CC0
- **Open Food Facts (India)** — ODbL

Full attribution is shown in-app at `/about/data`.

## Further reading

- Product & system design spec: [`docs/superpowers/specs/2026-10-06-eatri8-v2-design.md`](docs/superpowers/specs/2026-10-06-eatri8-v2-design.md)
- M1 implementation plan: [`docs/superpowers/plans/2026-10-06-m1-tracker.md`](docs/superpowers/plans/2026-10-06-m1-tracker.md)
