# EATRi8

EATRi8 is a mobile-first daily food tracker — MyFitnessPal-style logging made effortless by scanning — that tells you how healthy each food is, personalised to your diet, allergies and goals, and (from M2 onward) suggests a better option sold in your country. This milestone (M1) ships the tracker core: Google sign-in, onboarding, a seeded food catalogue (INDB + USDA FNDDS + Open Food Facts India, ~14.8k foods), search, food log, a Today view with a date switcher, and account settings. Scanning and AI-assisted extraction land in M2.

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
| `pnpm db:migrate` | Apply Drizzle migrations |
| `pnpm fetch:sources` | Download/refresh raw catalogue sources (INDB, USDA FNDDS, OFF India) |
| `pnpm seed:foods` | Normalise and seed the food catalogue into Postgres (idempotent on `(source, sourceRef)`) |
| `pnpm regrade` | Recompute stored food grades after a `gradeVersion` bump |
| `pnpm search:smoke` | Manual smoke check of search ranking against a fixed query list |

## Environment variables (M1)

| Var | Required | Source |
|---|---|---|
| `DATABASE_URL` | yes | Local: `postgres://eatri8:eatri8@localhost:5432/eatri8` from `pnpm db:up`. Hosted (Neon): the pooled connection string from the Neon dashboard. |
| `BETTER_AUTH_SECRET` | yes | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | yes | `http://localhost:3000` locally, your deployed URL in prod |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | yes | Google Cloud Console → OAuth 2.0 Web client; redirect URI `{BETTER_AUTH_URL}/api/auth/callback/google` |
| `OFF_CONTACT_EMAIL` | no | Contact email sent in the `User-Agent` header on Open Food Facts requests (`EATRi8/2.0 (<contact>)`) |
| `TEST_DATABASE_URL` | yes, for `pnpm test:int` | Points at a separate local database, e.g. `postgres://eatri8:eatri8@localhost:5432/eatri8_test` |

All env vars are validated at boot through `lib/env.ts` (zod; an empty string counts as unset). There are no `NEXT_PUBLIC_` secrets.

### Coming in M2

Not needed for M1; will be required once scanning ships:

- `GOOGLE_GENERATIVE_AI_API_KEY` — Google AI Studio key for the scanning/extraction engine
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` — Cloudflare R2 bucket + token for scan thumbnail storage

### Barcode decoding on /scan

The scan screen decodes EAN-13 / EAN-8 / UPC-A barcodes with the browser's `BarcodeDetector` where it
supports EAN-13 (Chrome on Android/macOS), and otherwise lazily loads [`zxing-wasm`](https://github.com/Sec-ant/zxing-wasm)
(only on `/scan`). For M2 the zxing wasm binary is fetched from zxing-wasm's default CDN
(`fastly.jsdelivr.net/npm/zxing-wasm@<version>/dist/reader/zxing_reader.wasm`). No Content-Security-Policy is
configured yet; when one is added, allow that origin in `connect-src` (and `script-src 'wasm-unsafe-eval'`),
or self-host the wasm via `prepareZXingModule({ overrides: { locateFile } })`.

## Data attribution

The food catalogue is built from:

- **Indian Nutrient Databank (INDB)** — CC BY 4.0
- **USDA FoodData Central (FNDDS)** — CC0
- **Open Food Facts (India)** — ODbL

Full attribution is shown in-app at `/about/data`.

## Further reading

- Product & system design spec: [`docs/superpowers/specs/2026-10-06-eatri8-v2-design.md`](docs/superpowers/specs/2026-10-06-eatri8-v2-design.md)
- M1 implementation plan: [`docs/superpowers/plans/2026-10-06-m1-tracker.md`](docs/superpowers/plans/2026-10-06-m1-tracker.md)
