# EATRi8 v2 — Backend, Engine & Credits (Sub-project 1)

- **Date:** 2026-10-06
- **Status:** Draft for review
- **Branch:** `v2` (fresh rewrite; `main` keeps the old app live until v2 merges)
- **Scope:** Everything except the visual UI design. Sub-project 2 (mobile UI) gets its own spec; this spec defines the routes, data and API that UI consumes.

---

## 1. Intent

**What:** A mobile-first web app where a user points their phone at food — a barcode, a nutrition label, the front of a pack, or an unpackaged meal — and gets an honest, explainable health verdict, personalised to their diet/allergies/goals, plus a healthier alternative available in their country.

**Who:** Everyday shoppers/eaters, initially in India; anonymous-feeling but signed in (Google).

**Success criteria**
1. One "Scan" button handles all four input kinds; the user never chooses a mode.
2. Same product → same score, every time (deterministic scoring).
3. Every fact shown carries provenance: *Verified (database)*, *Read from label*, or *Estimated*.
4. Running cost ≈ ₹0/month at low usage (free tiers); AI cost per scan ≲ ₹0.5.
5. Sellable foundation: auth, per-user data, a credit/plan system ready for a paid Pro tier.
6. Daily habit: every scan is kept in History, and any scan can be added to a meal in one tap; the Today screen tracks the day's calories and macros against the user's targets (optional — scanning works without ever logging).
7. Type-to-log like MyFitnessPal: search a built-in food catalogue ("boiled rice", "dal tadka", "coffee with milk") including Indian dishes and household portions (katori, roti, cup), plus the user's own custom foods and recents.

**Non-goals (v1):** payments/Pro checkout (UI shows "coming soon"), store-level availability or prices, native apps, admin dashboard, public share links / share cards, product comparison page, favourites, family profiles, weekly insights, meal planning/suggestions, natural-language meal entry ("2 rotis and dal") via LLM, barcode-less branded-food search beyond cached OFF products, contributing data back to Open Food Facts.

---

## 2. Architecture

Single Next.js app. API = Next route handlers under `/api/v1/*`. Core logic lives in framework-free modules so it can later move to Trigger.dev or a standalone Hono service without rewrites.

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript strict, pnpm |
| UI kit (details in sub-project 2) | Tailwind v4, shadcn/ui (new-york), lucide, sonner, recharts |
| Client data | Server components read the DB directly; TanStack Query only for scan polling + credit balance |
| Validation | zod 4 everywhere (env, API input, AI output, forms via react-hook-form) |
| Auth | Better Auth, Google OAuth only, Drizzle adapter (users in our Postgres) |
| DB | Neon Postgres (free tier) + Drizzle ORM + drizzle-kit migrations |
| AI | Vercel AI SDK, `@ai-sdk/google` default; model ids from env |
| Storage | Cloudflare R2 (free tier), thumbnails only, via `aws4fetch` |
| Errors | Sentry (free tier), basic PII scrubbing |
| Tests | Vitest (unit), `pnpm eval` (model accuracy harness) |
| CI | GitHub Actions: lint · typecheck · test · build |
| Hosting | Vercel Hobby (non-commercial OK while Basic-only; revisit when Pro launches) |
| PWA | Web manifest + icons, installable, standalone display |

### 2.1 Repository layout

```
app/
  (marketing)/page.tsx, privacy/, terms/
  (auth)/sign-in/
  (app)/today/, scan/, scans/[id]/, history/, settings/, credits/   ← authed shell (bottom tabs: Today · Scan · History · Settings)
  api/auth/[...all]/route.ts                                ← Better Auth
  api/v1/scans/route.ts                                     ← POST create scan
  api/v1/scans/[id]/route.ts                                ← GET status/result, DELETE
  api/v1/me/route.ts                                        ← GET profile + balance
  api/v1/log/route.ts                                       ← GET day log, POST entry
  api/v1/log/[id]/route.ts                                  ← PATCH, DELETE entry
lib/
  engine/          index.ts (runEngine) · triage-extract.ts · merge.ts · validate.ts
                   score/packaged.ts · score/meal.ts · personalise.ts · alternatives.ts
                   explain.ts · schema.ts · model.ts · errors.ts
                   sources/off.ts · sources/food-tables.ts
  credits/         logic.ts (pure) · ledger.ts (DB ops)
  log/             targets.ts (pure) · totals.ts (pure) · service.ts (DB ops)
  foods/           search.ts (DB query) · portions.ts (pure) · normalise.ts (pure)
scripts/           seed-foods.ts (imports data/sources/* → food table)
data/sources/      indb/ · fndds/ · portions-in.csv · aliases-in.csv · ATTRIBUTION.md
  scans/           service.ts (orchestrates engine + credits + storage + DB)
  db/              schema.ts · client.ts · migrations/
  auth.ts · env.ts · storage.ts · location.ts · rate-limit.ts
components/        ui/ (shadcn) · scan/ · result/ · history/
eval/              fixtures/*.jpg · expected/*.json · run.ts
```

**Rule:** `lib/engine/**` imports nothing from Next.js, Drizzle, or `lib/db`. It receives inputs + injected dependencies (`lookupBarcode`, `searchProducts`, `callModel`) and returns a result. This keeps it unit-testable offline.

---

## 3. Data model (Drizzle, Postgres)

Better Auth owns `user`, `session`, `account`, `verification`.

```ts
profile {
  userId          text PK → user.id
  country         text  (ISO-3166 alpha-2; default from x-vercel-ip-country, user-editable)
  diet            enum('none','vegetarian','eggetarian','vegan','jain')  default 'none'
  allergies       text[]  (canonical keys: 'peanut','tree_nut','milk','egg','gluten','soy','sesame','fish','shellfish','mustard')
  goal            enum('general','weight_loss','muscle','low_sugar','low_sodium') default 'general'
  plan            enum('basic','pro') default 'basic'
  targets         jsonb null  (DailyTargets override; null = derived from goal, §5.8)
  credits         integer not null default 0, CHECK (credits >= 0)
  allowancePeriod text    (e.g. '2026-10'; last month the allowance was granted)
  createdAt, updatedAt
}

credit_txn {
  id             uuid PK
  userId         text → user.id
  amount         integer  (+grant/+refund/−debit/−expire)
  type           enum('grant','debit','refund','expire','purchase')
  idempotencyKey text UNIQUE
  balanceAfter   integer
  scanId         uuid null → scan.id
  meta           jsonb null
  createdAt
}

product {
  id           uuid PK
  barcode      text UNIQUE null
  name, brand  text
  countries    text[]   (ISO alpha-2)
  categories   text[]   (OFF taxonomy tags, e.g. 'en:salty-snacks')
  facts100g    jsonb    (NutritionFacts, see §5.2)
  ingredients  text[]
  allergens    text[]
  nutriscore   char(1) null
  nova         smallint null
  source       enum('off','crowd')
  imageUrl     text null
  scanCount    integer default 0
  updatedAt
  INDEX (countries) GIN, (categories) GIN
}

scan {
  id            uuid PK (v7, time-ordered)
  userId        text → user.id
  status        enum('queued','processing','done','failed')
  inputKind     enum('barcode','label','front','meal','mixed') null (set after triage)
  barcode       text null
  imageCount    smallint
  productId     uuid null → product.id
  result        jsonb null   (EngineResult, see §5.6)
  confidence    enum('high','medium','low') null
  errorCode     text null
  thumbnailKey  text null
  engineVersion text
  modelId       text null
  tokensIn, tokensOut  integer null
  costMicros    integer null   (USD × 1e6)
  charged       boolean default false
  createdAt, startedAt, doneAt
  INDEX (userId, createdAt DESC), INDEX (createdAt)
}

food {
  id          uuid PK
  source      enum('indb','fndds','off','crowd','custom')
  sourceRef   text null          (source's own id; UNIQUE with source)
  ownerId     text null → user.id (only for source='custom'; private to owner)
  name        text               (display name, e.g. "Dal tadka")
  aliases     text[]             (e.g. "dal fry", "tadka dal", "दाल तड़का")
  brand       text null
  productId   uuid null → product.id (branded items mirrored from product)
  per100g     jsonb  Nutrients
  portions    jsonb  [{ label: "1 katori", grams: 150 }, { label: "1 cup", grams: 240 }]  (always also "100 g")
  defaultPortion smallint        (index into portions)
  countries   text[]             (relevance boost; INDB → ['IN'])
  popularity  integer default 0  (incremented when logged)
  searchText  tsvector GENERATED (name + aliases + brand)
  createdAt, updatedAt
  INDEX GIN(searchText), GIN(name gin_trgm_ops), (ownerId)
}

food_log {
  id          uuid PK (v7)
  userId      text → user.id
  date        date        (user's local date, sent by client; never derived server-side from UTC)
  meal        enum('breakfast','lunch','dinner','snack')
  scanId      uuid null → scan.id
  foodId      uuid null → food.id   (exactly one of scanId / foodId / neither-for-quick-entry)
  name        text                  (snapshot of product/dish name)
  portion     jsonb  { amount: number; unit: 'g'|'ml'|'serving'|'pack'; grams: number }
  nutrients   jsonb  Nutrients for this portion (snapshot — later product edits don't change past logs)
  createdAt, updatedAt
  INDEX (userId, date)
}

waitlist { userId PK, createdAt }   ← Pro "notify me"

`Nutrients` = `{ energyKcal, protein, carbs, fat, fibre?, sugars?, satFat?, sodiumMg? }` (all numbers; g unless named).
```

---

## 4. Credits & plans

Credits = the monthly allowance of **AI scans**. Pricing is deferred; numbers live in one config file (`lib/credits/plans.ts`) so they can change without migrations.

| | Basic (launch) | Pro (later) |
|---|---|---|
| Monthly AI-scan allowance | `20` (configurable) | `200` (configurable) |
| Barcode scans resolved from DB | free, unlimited | free, unlimited |

**Rules**
1. **Signup:** profile created on first sign-in; monthly allowance granted immediately (key `grant:{userId}:{YYYY-MM}`).
2. **Monthly reset, lazy:** whenever balance is read or spent, if `allowancePeriod` ≠ current month (UTC): write `expire` txn for leftover (key `expire:{userId}:{prevPeriod}`), then `grant` txn for the new allowance. No cron. No rollover.
3. **Cost:** 1 credit **only if the engine needs a model call**. Barcode hits with complete DB data cost 0.
4. **Debit (atomic):** in one DB transaction:
   `UPDATE profile SET credits = credits - 1 WHERE user_id = $1 AND credits >= 1 RETURNING credits` → if no row, fail `NO_CREDITS`; insert `credit_txn` (debit, key `scan:{scanId}`); set `scan.charged = true`. Unique key makes retries no-ops.
5. **Refund:** on any failure after charging, insert refund txn (key `refund:{scanId}`) and increment credits, in one transaction. Refund happens for: model errors, timeouts, unreadable images, not-food.
6. **Stuck scans:** when a scan is read and it is `queued|processing` with `startedAt` older than 2 min → mark `failed` (`TIMEOUT`) and refund if charged. No cron.
7. **Pre-check:** `POST /scans` rejects with 402 only when balance is 0 **and** no barcode was supplied (a barcode may resolve for free).
8. **Pure logic** (`lib/credits/logic.ts`): `currentPeriod(date)`, `needsReset(profile, now)`, `allowanceFor(plan)`, `canStartScan(profile, hasBarcode)` — unit-tested.

**Abuse & spend guards**
- Per-user: max 5 scans / 60 s (count on `scan` table) → 429.
- Global: `DAILY_AI_SCAN_CAP` model-calling scans per UTC day → 503 `SERVICE_BUSY` (no charge).
- Google Cloud billing budget alert at $5 (manual setup step).

---

## 5. Engine

`runEngine(input, deps): Promise<EngineResult>` — pure orchestration.

```ts
EngineInput {
  barcode?: string
  images: { mime: 'image/jpeg'|'image/webp'|'image/png'; data: Uint8Array }[]  // 0–3, already compressed client-side
  profile: { country; diet; allergies; goal; plan }
}
EngineDeps {
  lookupBarcode(code): Promise<ProductRecord|null>            // product table → OFF fallback, caches
  searchProducts(q: {name?, brand?, category?, country, minGrade?}): Promise<ProductRecord[]>
  extract(images, opts: {model: 'fast'|'strong', repairHint?}): Promise<{ data: Extraction; usage }>
  now(): Date
}
```

### 5.1 Pipeline

| # | Step | Paid? | Details |
|---|---|---|---|
| 0 | Client prep | — | Phone decodes barcode (BarcodeDetector API, `zxing-wasm` fallback) from live camera or photos; compresses images to long edge 1600 px, JPEG q≈0.8; makes a 320 px WebP thumbnail. |
| 1 | Resolve barcode | free | `lookupBarcode`. If record has complete `facts100g` (energy, fat, satFat, carbs, sugars, protein, salt/sodium) and no images were sent → skip to step 4 with provenance `database`. |
| 2 | Triage + extract | 1 credit | One vision call (`fast` model), structured output (§5.2). Returns per-image `kind` + extracted data + quality issues. |
| 2b | Resolve front-of-pack | free | If kind=`front` and no panel data: `searchProducts({name, brand, country})`; accept match if name similarity ≥ 0.8 and brand matches → provenance `database`; else keep model's estimate → provenance `estimate`, add hint "Add a photo of the back for exact facts". |
| 2c | Resolve meal | free | kind=`meal`: model returns dish name(s) + estimated grams; nutrients from model estimate (v1). Provenance `estimate`. `food-tables.ts` is an interface stub for USDA FDC / IFCT lookup in v1.1. |
| 3 | Merge | free | Label-read values override DB values field-by-field (formulations change); DB fills gaps. Each field records its provenance. |
| 3b | Validate | free | Checks below. Fail → one repair call with the failing checks as `repairHint` using `strong` model (no extra credit). Still failing → keep, confidence `low`. |
| 4 | Score | free | `score/packaged.ts` or `score/meal.ts` (§5.3). |
| 5 | Personalise | free | Allergen & diet matching (§5.4). |
| 6 | Alternatives | free | §5.5. Skipped for grade A/B. |
| 7 | Explain | free | Template reasons from score components + flags; no LLM. |

**Validation checks** (on per-100 g facts, tolerance noted):
- `energyKcal ≈ 4·protein + 4·carbs + 9·fat (+2·fibre)` within ±15 % (or ±20 kcal for low-energy foods)
- every macro in g ≤ 100; `sugars ≤ carbs`; `satFat ≤ fat`
- `salt ≈ 2.5 × sodium` within ±10 % when both present (fill the missing one)
- kJ/kcal consistency when both printed (`kJ ≈ 4.184 × kcal`)
- serving size present ⇒ per-serving values ≈ per-100 g × serving/100 within ±10 %

### 5.2 Extraction schema (zod, sent to the model as structured output)

```ts
Extraction {
  images: { index; kind: 'barcode'|'nutrition_panel'|'ingredients'|'front'|'meal'|'not_food'|'unreadable';
            quality: ('blurry'|'glare'|'cropped'|'too_dark')[] }[]
  product?: { name; brand?; variant?; categoryGuess?: string; packSize?: {value; unit} }
  facts?: { basis: 'per_100g'|'per_100ml'|'per_serving'; servingSize?: {value; unit};
            energyKcal?; energyKj?; protein?; carbs?; sugars?; addedSugars?; fat?; satFat?; transFat?;
            fibre?; sodiumMg?; saltG?; }
  ingredients?: string[]          // in printed order, normalised to English
  allergensDeclared?: string[]    // canonical keys from §3
  additives?: string[]            // E-numbers / INS codes
  meal?: { items: { name; grams; kcal; protein; carbs; fat; fibre?; sugars?; sodiumMg? }[] }
  printedLanguage?: string
}
```

Per-serving facts are converted to per-100 g in code (not by the model). Prompt instructs: transcribe, don't judge; leave fields empty rather than guess, except `meal` and front-of-pack fallback estimates which are explicitly flagged.

### 5.3 Scoring (deterministic, `engineVersion` bumps on change)

**Packaged** — Nutri-Score 2023 algorithm (general foods, beverages, fats/oils, cheese categories) on per-100 g/ml facts → points → grade A–E.
- Fruit/veg/legume % rarely printed: estimate from ingredient list position; mark the component `estimated`.
- Processing modifier: NOVA 4 (from OFF, or inferred from ≥ 3 additives / known ultra-processed markers) → downgrade by at most one grade, with reason.
- Display: grade A–E + 0–100 score (linear map of points within grade band).

**Meal** — per-portion rules (v1, tunable constants in one file): start at 100; penalties for sodium > 600 mg, sugars > 15 g, satFat > 7 g, energy > 700 kcal (scaled); bonuses for protein ≥ 20 g, fibre ≥ 6 g; map to A–E bands (≥80 A, ≥65 B, ≥50 C, ≥35 D, else E). Portion editable in UI → rescored client-side using the same pure function.

**Goal adjustments** (`goal ≠ general`): reweight penalties (e.g. `low_sodium` doubles the sodium penalty, `muscle` doubles the protein bonus). Shown as "Adjusted for your goal".

### 5.4 Personalisation
- Allergens: match `allergensDeclared` ∪ ingredient keyword map (multilingual synonyms, e.g. "groundnut"→peanut, "maida"→gluten) against `profile.allergies` → `flags[]` with severity `contains` / `may_contain` (from "may contain traces").
- Diet: keyword/additive rules per diet (e.g. jain: onion, garlic, potato…; vegan: milk solids, ghee, gelatin, E120…).
- Copy always ends with "Check the pack to confirm."

### 5.5 Healthier alternatives
- Inputs: product categories (OFF tags or model `categoryGuess` mapped to nearest tag), `profile.country`.
- Query: `product` table first (crowd + cached OFF) then OFF search API: same category, `countries` contains user country, grade strictly better, sorted by grade then `scanCount`/OFF popularity. Top 5 stored; Basic sees 1 (plan gating in UI only for v1).
- No product match → one generic category tip from a static map (e.g. `en:salty-snacks` → "Roasted chana or makhana are lower in fat and sodium").
- OFF results cached into `product` with `source='off'` (TTL 30 days via `updatedAt`).

### 5.6 Result shape (stored in `scan.result`)

```ts
EngineResult {
  kind: 'packaged'|'meal'
  product?: { id?; name; brand?; imageUrl? }
  facts: Record<NutrientKey, { value; unit; provenance: 'database'|'label'|'estimate' }>
  basis: 'per_100g'|'per_100ml'|'per_portion'
  portion?: { grams; editable: boolean }
  score: { grade: 'A'|'B'|'C'|'D'|'E'; value: number; components: ScoreComponent[]; goalAdjusted: boolean }
  reasons: { tone: 'good'|'warn'|'bad'; text: string }[]   // top 3 surfaced first
  flags: { type: 'allergen'|'diet'; key: string; severity: 'contains'|'may_contain'; text: string }[]
  ingredients?: { text: string; flagged: boolean }[]
  alternatives: { productId; name; brand?; grade; imageUrl? }[]
  tip?: string
  hints: string[]                 // e.g. "Add a photo of the back for exact facts"
  confidence: 'high'|'medium'|'low'
}
```

**Confidence:** `high` = DB-complete barcode, or label read with all checks passing. `medium` = front matched to DB by name, or label passing after repair. `low` = any estimate (unmatched front, meals) or checks still failing.

### 5.7 Model layer (`lib/engine/model.ts`)
- `MODEL_FAST` default `gemini-3.1-flash-lite`; `MODEL_STRONG` default `gemini-3.5-flash` (exact ids verified against provider docs at implementation time; Gemini 2.5 family is retiring).
- AI SDK `generateObject` with the zod schema; `temperature` low where supported; timeout 45 s via `AbortSignal.timeout`.
- Retry policy: retry 429 / 5xx / network / timeout up to 2× with jittered backoff; never retry 4xx, safety blocks, or schema failures (those go to the single repair path).
- Usage → `tokensIn/out` and `costMicros` (price table in `model.ts`, per model id).
- Swapping provider (Claude Haiku 4.5, Qwen3-VL via OpenRouter) = new provider package + env change.

### 5.8 Daily targets & portions (`lib/log`, pure)
- **Default targets by goal** (reference-intake style, adult, not personalised by body metrics — no medical claims): `general` 2000 kcal · protein 60 g · carbs 275 g · fat 67 g · fibre 30 g · sugars ≤ 50 g · sodium ≤ 2000 mg. Goal presets adjust these (e.g. `weight_loss` 1700 kcal; `muscle` protein 100 g; `low_sugar` sugars ≤ 25 g; `low_sodium` sodium ≤ 1500 mg). Constants live in `targets.ts`.
- User may override any target in Settings (`profile.targets`).
- **Portion → grams:** `g`/`ml` direct (ml ≈ g); `serving` uses label `servingSize`; `pack` uses `packSize`; missing size ⇒ unit not offered. Meal scans default to the engine's estimated grams.
- `totals.ts`: sums entries per day and per meal; `remaining = target − total` (floors at 0 for "≤" limits shown as "over by").

### 5.9 Food catalogue & search
**Seed data (imported once by `pnpm seed:foods`, re-runnable/idempotent on `(source, sourceRef)`):**

| Source | What | Size | License |
|---|---|---|---|
| **INDB** — Indian Nutrient Databank (Anuvaad / Jaacks et al., 2024) | ~1,014 commonly consumed Indian recipes (dal, roti, poha, biryani…) per 100 g + serving size; ~1,095 ingredients | ~2k rows | CC BY 4.0 (attribution required) |
| **USDA FNDDS** (FoodData Central) | ~5–7k common foods & drinks "as eaten" with household portion weights (cup, slice, piece) | ~6k rows | CC0 / public domain |
| **Open Food Facts** | branded packaged products — not bulk-imported; mirrored into `food` when first cached via barcode/scan | grows organically | ODbL (attribution; share-alike applies to the database if we redistribute it — we only display, so attribution suffices) |
| **Crowd** | products our users scanned (from `product`) | grows | ours |
| **Custom** | user-created foods, private | — | user's |

IFCT 2017 (NIN) is *not* used: it covers raw ingredients only and its data licensing for commercial use is unclear; INDB already incorporates IFCT-derived values for recipes.

**Indian household portions & aliases:** `data/sources/portions-in.csv` maps food groups to units (katori 150 g, roti 40 g, idli 40 g, dosa 80 g, glass 250 ml, cup 150 ml, tbsp 15 g, tsp 5 g, piece by item). `aliases-in.csv` adds Hinglish/Hindi names (chawal→rice, aloo→potato, sabzi, etc.). Both are small hand-curated files, versioned in the repo.

**Search (Postgres only — `pg_trgm` + full-text, no external search service):**
1. Normalise query (lowercase, strip punctuation, alias expansion).
2. Candidates: `searchText @@ websearch_to_tsquery(q)` OR `similarity(name, q) > 0.3` (typo tolerance: "biriyani", "panner").
3. Visible rows: all non-custom + `custom` where `ownerId = me`.
4. Rank: own custom foods & recents first → exact/prefix name match → `countries` contains user country → source priority (custom > crowd > indb > off > fndds for IN; fndds before indb elsewhere) → `popularity`.
5. Return `FoodHit { id, name, brand?, source, kcalPer100g, defaultPortion: {label, grams, kcal} }`.

Target: p95 < 150 ms on Neon free for ~10k rows.

---

## 6. API (`/api/v1`)

All JSON; auth via Better Auth session cookie (Bearer plugin enabled for future native client). Errors: `{ error: { code, message } }` with fixed, user-safe messages.

| Method & path | Body / params | Success | Errors |
|---|---|---|---|
| `POST /scans` | multipart: `images[]` (0–3, each ≤ 1.5 MB, jpeg/webp/png), `thumbnail?` (≤ 100 KB webp), `barcode?` (EAN-8/13, UPC-A) — at least one of images/barcode | `202 { scanId, status }` (or `200 { scanId, status:'done' }` when barcode resolved synchronously) | 400 `INVALID_INPUT`, 401, 402 `NO_CREDITS`, 413 `TOO_LARGE`, 429 `RATE_LIMITED`, 503 `SERVICE_BUSY` |
| `GET /scans/:id` | — | `200 { id, status, result?, errorCode?, createdAt, thumbnailUrl? }` (owner only; applies stuck-scan sweep) | 401, 404 |
| `DELETE /scans/:id` | — | `204` | 401, 404 |
| `GET /me` | — | `200 { profile, credits, plan, allowance, periodResetsAt }` (applies lazy monthly reset) | 401 |

| `GET /log?date=YYYY-MM-DD` | — | `200 { date, entries[], totals: Nutrients, targets: DailyTargets, byMeal: Record<Meal, Nutrients> }` | 400, 401 |
| `POST /log` | `{ date, meal, portion }` + one of `scanId` · `foodId` · `{ name, nutrients }` (quick entry) | `201 { entry }` — nutrients computed server-side from scan facts / food per100g × portion grams | 400, 401, 404 (scan/food not visible to user) |
| `GET /foods?q=&limit=20` | `q` ≥ 2 chars | `200 { results: FoodHit[] }` — see §5.9 ranking | 400, 401 |
| `GET /foods/recent` | — | `200 { results: FoodHit[] }` — user's 20 most recently/frequently logged foods + scans | 401 |
| `POST /foods` | `{ name, brand?, per: {amount, unit}, nutrients, portions? }` (custom food; per-serving input converted to per100g) | `201 { food }` | 400, 401 |
| `PATCH /foods/:id`, `DELETE /foods/:id` | custom foods owned by the user only | `200` / `204` | 401, 404 |
| `PATCH /log/:id` | `{ meal?, portion?, date? }` (recomputes snapshot nutrients from the scan if portion changes) | `200 { entry }` | 400, 401, 404 |
| `DELETE /log/:id` | — | `204` | 401, 404 |

Logging and food search are free (no credits). A scan may be logged multiple times (e.g. same snack twice a day). A scan result can be saved as a custom food ("Save to my foods") so it's searchable later.

Profile updates (incl. custom targets), account deletion, waitlist join = **server actions** (UI-only, not part of the public API).

**POST /scans flow:** auth → validate (zod) → rate limit → lazy reset → barcode fast-path (sync, free) → else daily-cap check → create `scan(queued)` → debit → upload thumbnail to R2 → respond 202 → `after()`: `status=processing` → `runEngine` → save result/`done` or `failed`+refund → upsert crowd `product` (label/front scans with name + facts) → increment `scanCount`.
Route config: `export const maxDuration = 60`.

**Client polling:** TanStack Query `refetchInterval: 2000` while status ∈ {queued, processing}; stop on terminal; invalidate `me` on finish.

**Error codes surfaced to users:** `NO_CREDITS`, `RATE_LIMITED`, `SERVICE_BUSY`, `UNREADABLE_IMAGE`, `NOT_FOOD`, `MODEL_ERROR`, `TIMEOUT`, `INVALID_INPUT`, `TOO_LARGE`. Each maps to one fixed sentence + a recovery action ("Retake photo", "Try again", "See plans"). Failed scans after charging always state "Your credit was refunded."

---

## 7. Auth, location, privacy, security
- Better Auth: Google provider only; session cookie; `proxy.ts` redirects unauthenticated `(app)` routes to `/sign-in`. Profile row created in the `user.create.after` hook.
- Country: `x-vercel-ip-country` header on profile creation; editable in Settings.
- Full-size images are never stored — used in memory for the model call, then discarded. Only a 320 px thumbnail goes to R2 at `u/{userId}/{scanId}.webp`, read via short-lived signed URLs.
- Account deletion: deletes user (cascade profile/scans/txns) + R2 prefix `u/{userId}/`.
- Secrets server-only; `lib/env.ts` validates with zod at boot (empty string = unset). No `NEXT_PUBLIC_` secrets. **Rotate the old Gemini key** (it is in git history, commit `4d2b34c`).
- Gemini paid tier at launch for any real users (free tier may use inputs for training); free tier acceptable for dev/eval.
- Disclaimers on result + terms: informational, not medical advice; allergens "check the pack".
- Data attribution page (`/about/data`) credits INDB (CC BY), USDA FoodData Central, and Open Food Facts (ODbL).
- OFF API calls send a descriptive `User-Agent` (`EATRi8/2.0 (contact email)`) as OFF requires.

---

## 8. Testing & quality
- **Unit (Vitest), offline:** credits logic, validation checks, Nutri-Score (against published reference examples), meal scoring, per-serving→per-100 g conversion, allergen/diet matching, merge precedence, alternatives ranking, `runEngine` with fake deps for each input kind (barcode-hit, label, front-matched, front-unmatched, meal, unreadable, not-food).
- **Foods unit tests:** query normalisation + alias expansion, per-serving→per100g conversion for custom foods, portion resolution; **integration:** search ranking fixtures ("rice" returns boiled rice before rice flour; "panner" finds paneer; another user's custom food never appears).
- **Log unit tests:** portion→grams for each unit, nutrient snapshot = facts × grams/100, day/meal totals, goal-preset targets + overrides.
- **Integration (Vitest + Neon branch or local Postgres via Docker):** debit/refund idempotency under concurrent requests (two parallel debits with balance 1 → exactly one succeeds), monthly reset, stuck-scan sweep.
- **Eval (`pnpm eval`):** 25–30 fixtures (Indian + international packs, Hindi/regional labels, blurry/angled, fronts, meals) with hand-written expected JSON. Reports per-field accuracy (±5 % numeric tolerance), schema-failure rate, triage accuracy, p50/p95 latency, cost/scan per model. Used to choose `MODEL_FAST`/`MODEL_STRONG`. Not in CI (costs money); run manually.
- **CI:** lint (ESLint 9 + next core-web-vitals, 0 warnings), `tsc --noEmit`, `vitest run`, `next build`.

---

## 9. Environment variables

| Var | Required | Source |
|---|---|---|
| `DATABASE_URL` | yes | Neon project → connection string (pooled) |
| `BETTER_AUTH_SECRET` | yes | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | yes | `http://localhost:3000` locally; prod URL on Vercel |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | yes | Google Cloud Console → OAuth client (Web); redirect `{BETTER_AUTH_URL}/api/auth/callback/google` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | yes | Google AI Studio (new key — rotate the leaked one) |
| `MODEL_FAST` / `MODEL_STRONG` | no | defaults in code |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | yes | Cloudflare → R2 → bucket + API token (object read/write) |
| `DAILY_AI_SCAN_CAP` | no | default `300` |
| `OFF_CONTACT_EMAIL` | no | used in OFF User-Agent |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | no | Sentry project (optional at launch) |

---

## 10. Build order (input to the implementation plan)
1. Scaffold v2 (wipe old files, Next 16 + Tailwind v4 + shadcn init, lint/test/CI, env schema).
2. DB schema + migrations; Better Auth with Google; profile hook; `proxy.ts`.
3. Credits module (logic + ledger) with tests.
4. Engine: schema, validate, scoring, personalise, explain (pure, tested) → model layer → OFF source → alternatives.
5. Scans service + `/api/v1` routes + R2 thumbnails.
6. Eval harness + fixtures; pick models.
7. Food catalogue: `food` table, seed script (INDB + FNDDS + portions/aliases) → search + recents + custom foods routes.
8. Food log: `lib/log` (pure, tested) → table + `/api/v1/log` routes.
9. Minimal functional UI wiring (unstyled) to exercise end-to-end — real styling comes from sub-project 2.

## 11. Open items (decide later, not blocking)
- Final plan pricing/allowances and Pro payment provider (Razorpay likely) + hosting move off Vercel Hobby when Pro launches.
- USDA FDC / IFCT integration for meals (v1.1).
- Contributing crowd data back to Open Food Facts.
- Natural-language quick add ("2 rotis and dal") — cheap LLM parse mapped onto catalogue items; likely Pro or 1 credit.
- Later list (from scoping): share cards, compare two products, favourites/"my usual", family profiles (Pro), weekly insights (Pro), meal suggestions/planning (Pro).
