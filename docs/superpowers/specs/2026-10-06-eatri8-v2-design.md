# EATRi8 v2 — Product & System Design

- **Date:** 2026-10-06 (rev 2 — restructured around daily tracking)
- **Status:** Reviewed (rev 4 — two review passes applied, see §14)
- **Branch:** `v2` (fresh rewrite; `main` keeps the old app live until v2 merges)
- **Companion:** UI/visual spec (sub-project 2) follows after the mock dry run; this spec defines product behaviour, screens' responsibilities, data, API and engine.

---

## 1. Product

### 1.1 One-liner
A mobile-first daily food tracker — **MyFitnessPal-style logging, made effortless by scanning** — that tells you how healthy each food is, personalised to your diet, allergies and goals, and suggests a better option sold in your country.

### 1.2 Core loop
```
         ┌───────────── Add food (3 ways, one sheet) ─────────────┐
         │  🔍 Search    "boiled rice", "dal tadka", "coffee"     │  free
         │  📷 Scan      barcode · label · front of pack · meal   │  barcode free · AI scan = 1 credit
         │  ✏️ Quick add  name + calories/macros                  │  free
         └───────────────────────────┬────────────────────────────┘
                                     ▼
              Food detail: grade A–E · reasons · flags · portion picker
                                     ▼
                       "Add to Breakfast / Lunch / Dinner / Snack"
                                     ▼
              Today: calories & macros vs targets, by meal  ──► habit
```
Every scan is also kept in **History**, logged or not. Any food (searched, scanned, custom) can be logged any number of times.

### 1.3 Who & success criteria
**Who:** everyday eaters/shoppers, India first (Indian dishes, katori/roti portions, Hinglish search), works globally.

1. Logging a common food takes ≤ 3 taps from Today (recents) and ≤ 5 via search.
2. One Scan button handles barcode, label, front-of-pack and meal photos — the user never picks a mode.
3. Same food → same grade, every time, everywhere (deterministic, neutral grade; personal concerns are shown as flags, never as a different grade). Every gradeable food shows a grade; ingredients like oil, salt, spices show "Not graded".
4. Every nutrient shown carries provenance: *Reference* (INDB/USDA), *Community* (Open Food Facts / other users' scans), *Read from label*, or *Estimated*.
5. Tracking works with zero AI cost; only AI scans consume credits. Infrastructure ≈ ₹0/month on free tiers; AI is pay-per-use on Gemini's paid tier at ≲ ₹0.5/scan (free tier for development only).
6. Sellable foundation: auth, per-user data, credits, Basic/Pro plans (Pro checkout later).

### 1.4 Scope
**v1 (this spec):** onboarding, Today/diary, add-food sheet (search · scan · quick add), food detail + portion + log, food catalogue (INDB + USDA + OFF + crowd + custom), recents, custom foods, scanning engine (4 input kinds), grades & personalisation, healthier alternatives by country, History (scans), Settings (profile, diet, allergies, goal, targets, country, theme), Credits page with Basic plan + Pro waitlist, PWA install.

**Later list:** workout tracker (M4), natural-language add ("2 rotis and dal"), share cards, compare two products, favourites / saved meals, copy yesterday's meal, family profiles (Pro), weekly insights & trends (Pro), meal planning/suggestions (Pro), water tracking, Pro payments (Razorpay), store-level availability/prices, native apps, contributing data back to OFF.

### 1.5 Routes & responsibilities
Bottom tabs (mobile-first): **Today · Foods · ( Scan ) · History · Me** — Scan is the raised centre button.

| Route | Responsibility |
|---|---|
| `/` | Marketing landing (signed-out); signed-in → `/today` |
| `/sign-in` | Google sign-in |
| `/onboarding` | 4 steps, skippable: goal → diet → allergies → targets (pre-filled from goal). Country auto-detected. |
| `/today?date=` | Diary for a day: calorie ring + macro bars vs targets; meal sections with entries; "+" per meal opens Add sheet preset to that meal; date switcher (past days live here). Without `date`, "today" is computed in `profile.timezone`. |
| Add sheet (overlay, from Today/Foods) | Tabs: Search (recents shown before typing) · Scan · Quick add. |
| `/foods` | Search, Recents, My foods (custom), "Create food". |
| `/foods/[id]` | Food detail: grade, reasons, flags, nutrients with provenance, portion picker, alternatives, "Add to meal". |
| `/scan` | Camera: live barcode detection + photo capture (1–3) + gallery; progress; on done → `/scans/[id]`. |
| `/scans/[id]` | Scan result = food detail + provenance/confidence + hints ("add a photo of the back"); "Add to meal", "Save to my foods". |
| `/history` | All past scans (search, filter by grade). Past diary days are reached via the Today date switcher. |
| `/me` | Profile, goal, diet, allergies, targets, country, theme; Credits & plan; data attribution; privacy/terms; delete account. |
| `/me/credits` | Balance, monthly reset date, transaction list, Basic vs Pro card ("Pro coming soon — join waitlist"). |
| `/privacy`, `/terms`, `/about/data` | Static. |

---

## 2. Architecture

Single Next.js app; API = route handlers under `/api/v1/*` (JSON; a Bearer-token plugin can be added when a native client exists). Core logic in framework-free modules (`lib/engine`, `lib/credits`, `lib/nutrition`) so it can move to Trigger.dev or a standalone service later without rewrites.

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript strict, pnpm |
| UI kit | Tailwind v4, shadcn/ui (new-york), lucide, sonner, vaul (drawers/sheets), recharts — visuals per UI spec |
| Client data | Server components read DB directly; TanStack Query for interactive bits (search-as-you-type, scan polling, diary mutations with optimistic updates, credit balance) |
| Validation | zod 4 everywhere (env, API input, AI output, forms via react-hook-form) |
| Auth | Better Auth, Google OAuth, Drizzle adapter |
| DB | Neon Postgres (free tier) + Drizzle + drizzle-kit; extension `pg_trgm` (diacritics are stripped in JS, so `unaccent` isn't needed). Driver: `drizzle-orm/neon-serverless` with the `@neondatabase/serverless` **Pool (WebSocket)** — required because credits/log use interactive transactions, which the `neon-http` driver can't do. Tests run against Docker Postgres 17 via `drizzle-orm/node-postgres`. Neon scales to zero: first query after idle adds ~0.5–1 s. |
| AI | Vercel AI SDK, `@ai-sdk/google` default; model ids from env |
| Storage | Cloudflare R2 (free tier), scan thumbnails only, via `aws4fetch` |
| Errors | Sentry (free tier), basic PII scrubbing |
| Tests | Vitest; `pnpm eval` model harness |
| CI | GitHub Actions: lint · typecheck · test · build |
| Hosting | Vercel Hobby for development and private beta. Hobby is non-commercial only; a public launch with a plans page counts as commercial, so **decide Vercel Pro vs Cloudflare before public launch** (§13). Fluid compute: max function duration 300 s; request body limit 4.5 MB. |
| PWA | Manifest, icons, standalone, safe-area aware |

### 2.1 Repository layout
```
app/
  (marketing)/  page.tsx · privacy/ · terms/ · about/data/
  (auth)/       sign-in/
  (app)/        layout.tsx (tab bar shell) · onboarding/ · today/ · foods/ · foods/[id]/
                scan/ · scans/[id]/ · history/ · me/ · me/credits/
  api/auth/[...all]/route.ts
  api/v1/       me/ · foods/ · foods/[id]/ · foods/recent/ · log/ · log/[id]/ · scans/ · scans/[id]/
lib/
  nutrition/    types.ts (Nutrients, Portion) · portions.ts · targets.ts · totals.ts · grade/{packaged,dish}.ts
                personalise.ts · explain.ts · classify.ts   ← pure, shared by catalogue foods and scans
  engine/       index.ts (runEngine) · triage-extract.ts · merge.ts · validate.ts · alternatives.ts
                schema.ts · model.ts · errors.ts · sources/off.ts
  foods/        search.ts · normalise.ts · service.ts
  log/          service.ts
  scans/        service.ts (engine + credits + storage + DB)
  credits/      plans.ts · logic.ts (pure) · ledger.ts
  db/           schema.ts · client.ts · migrations/
  auth.ts · env.ts · storage.ts · location.ts · rate-limit.ts (Postgres-backed counts; no in-memory state)
  authz.ts      visibleFoodWhere(userId) · ownScan(userId, id) · ownLogEntry(userId, id) — used by every route
components/     ui/ (shadcn) · today/ · add-food/ · food/ · scan/ · history/ · me/
scripts/        fetch-sources.ts · seed-foods.ts · regrade.ts
data/sources/   indb/ · fndds/ · portions-in.csv · aliases-in.csv · ATTRIBUTION.md
eval/           fixtures/ · expected/ · run.ts
```
**Rule:** `lib/nutrition/**` and `lib/engine/**` import nothing from Next.js, Drizzle or `lib/db`; dependencies are injected. Unit-testable offline.

---

## 3. Data model (Drizzle, Postgres)

Better Auth owns `user`, `session`, `account`, `verification`.

**Single food model:** every loggable thing is a `food` row — catalogue dishes, generic foods, branded products (barcode), crowd products from scans, and user custom foods. This replaces a separate `product` table.

```ts
Nutrients = { energyKcal, protein, carbs, fat, fibre?, sugars?, addedSugars?, satFat?, transFat?, sodiumMg? }  // g unless named
NutrientKey = keyof Nutrients        // salt is derived (saltG = sodiumMg × 2.5 / 1000), never stored; kJ only in extraction
Provenance = 'reference' | 'community' | 'label' | 'estimate'
Portion = { label: string; amount: number; unit: 'g'|'ml'|'serving'|'pack'|'household'; grams: number | null }   // grams null = unknown size
Reason = { tone: 'good'|'warn'|'bad'; text: string }
Flag = { type: 'allergen'|'diet'|'goal'; key: string; severity: 'contains'|'may_contain'|'note'; text: string }

profile {
  userId PK → user.id
  country text (ISO alpha-2; from x-vercel-ip-country, editable)
  diet enum('none','vegetarian','eggetarian','vegan','jain') default 'none'
  allergies text[]  ('peanut','tree_nut','milk','egg','gluten','soy','sesame','fish','shellfish','mustard')
  goal enum('general','weight_loss','muscle','low_sugar','low_sodium') default 'general'
  targets jsonb null           (overrides; null = preset from goal, §5.2)
  timezone text default 'Asia/Kolkata'   (IANA; set from the browser's Intl on first visit; used for "today")
  onboardedAt timestamp null
  plan enum('basic','pro') default 'basic'
  credits integer not null default 0 CHECK (credits >= 0)
  allowancePeriod text null    ('2026-10'; null until the first lazy reset grants the allowance)
  createdAt, updatedAt
}

food {
  id uuid PK
  source enum('indb','fndds','off','crowd','custom')
  sourceRef text null           UNIQUE(source, sourceRef)
  ownerId text null → user.id   (custom only; private)
  kind enum('dish','generic','packaged','ingredient')   (ingredient = raw/cooking items: not graded, demoted in search)
  gradeCategory enum('general','beverage','water','fat_oil','cheese','dish','none')   (set by classify.ts per source; decides the grading algorithm)
  name text · brand text null · aliases text[]
  barcode text null UNIQUE
  basis enum('per_100g','per_100ml')
  per100 jsonb Nutrients
  provenance jsonb  Record<NutrientKey, Provenance>
  portions jsonb Portion[]       (always includes 100 g/ml; serving/pack when known; household from portions-in.csv)
  defaultPortion smallint
  gradePortionGrams smallint null   (dishes: fixed reference portion used for grading, frozen at creation — portion edits never change the grade)
  ingredients text[] · allergens text[] · additives text[]
  categories text[] (OFF taxonomy tags) · countries text[]
  nutriscoreSource char(1) null · nova smallint null      (as supplied by OFF)
  grade char(1) null · gradeValue smallint null · gradeVersion text   (ours, §5.3; null = not graded; `scripts/regrade.ts` recomputes on version bump)
  normName text · normBrand text      (lowercase, unaccented, punctuation stripped — dedupe keys)
  deletedAt timestamp null          (soft delete for custom foods: hidden from search/detail, keeps FKs valid)
  imageUrl text null
  popularity integer default 0      (times logged across users)
  searchName text                    (normName + normBrand + normalised aliases, space-joined — trigram target)
  searchText tsvector                (to_tsvector('simple', searchName))
      Both are written by the app on every insert/update via `buildSearchFields()` in lib/foods/normalise.ts
      (JS NFD diacritic stripping) — no generated columns, so no IMMUTABLE problems with unaccent()/array_to_string().
  createdAt, updatedAt
  INDEX GIN(searchText), GIN(searchName gin_trgm_ops), (ownerId), (barcode), GIN(categories), GIN(countries)
  UNIQUE (source, normName, normBrand) WHERE barcode IS NULL AND source = 'crowd'   (crowd dedupe)
}

scan {
  id uuid PK (v7)
  userId → user.id
  status enum('queued','processing','done','failed')
  inputKind enum('barcode','label','front','meal') null   (dominant kind)
  barcode text null · imageCount smallint
  foodId uuid null → food.id        (the resolved/created food)
  result jsonb null                 (ScanResult, §7.5 — a snapshot; not regraded on gradeVersion bump)
  confidence enum('high','medium','low') null
  errorCode text null · thumbnailKey text null
  engineVersion text · modelId text null · tokensIn int null · tokensOut int null · costMicros int null
  charged boolean default false
  createdAt, startedAt, doneAt
  INDEX (userId, createdAt DESC), (createdAt)
}

food_log {
  id uuid PK (v7)
  userId → user.id
  date date                         (user's local date, sent by client)
  meal enum('breakfast','lunch','dinner','snack')
  foodId uuid null → food.id ON DELETE SET NULL
  scanId uuid null → scan.id ON DELETE SET NULL   (set when logged from a scan result)
  name text                         (snapshot)
  portion jsonb { amount, unit: 'g'|'ml'|'serving'|'pack'|'household', label, grams }
  nutrients jsonb Nutrients         (snapshot for this portion)
  grade char(1) null                (snapshot; not regraded)
  createdAt, updatedAt
  INDEX (userId, date)
}
  // quick add = foodId null, scanId null, name + nutrients given

user_food_stats { userId, foodId, uses int, lastUsedAt  PK(userId, foodId) }   ← powers Recents

credit_txn {
  id uuid PK · userId → user.id
  amount integer · type enum('grant','debit','refund','expire','purchase')
  idempotencyKey text UNIQUE · balanceAfter integer · scanId uuid null · meta jsonb null · createdAt
}

waitlist { userId PK, createdAt }
```

**How scans become foods:** a barcode hit reuses the existing `food`. A label/front scan becomes a shared `crowd` food **only if confidence is `high` and validation passed** (otherwise the result stays scan-only). Upserts use `ON CONFLICT (barcode)` or the crowd unique index; an existing row is only updated by a result of equal or higher confidence. Crowd foods never use a user's thumbnail as `imageUrl`. Meal scans do **not** create food rows: they are logged straight from the scan result (`food_log.scanId`, `foodId` null); "Save to my foods" turns any scan into a private `custom` food. Only packaged products become shared (crowd) foods.

**Log entries are self-contained:** `nutrients` + `portion.grams` are a snapshot. Editing an entry's portion rescales the snapshot (`nutrients × newGrams / oldGrams`), so edits keep working after the source food or scan is deleted.

---

## 4. Credits & plans

Credits = monthly allowance of **AI scans**. Tracking, search, barcode hits, logging: always free. Numbers live in `lib/credits/plans.ts` (pricing decided later).

| | Basic (launch) | Pro (later, waitlist in v1) |
|---|---|---|
| AI scans / month | 20 (config) | 200 (config) |
| Search, barcode, logging, custom foods | unlimited | unlimited |
| Alternatives shown | top 1 | top 5 |

**Rules**
1. **Signup:** `ensureProfile(userId)` (`INSERT … ON CONFLICT DO NOTHING`) runs on every authenticated request path that reads the profile, so a failed auth hook can't leave a user without a profile. The first allowance comes from the lazy reset (period starts null).
2. **Monthly reset, lazy** (on any balance read/spend), one transaction: `UPDATE profile p SET credits = $allowance, allowance_period = $cur FROM (SELECT credits AS old FROM profile WHERE user_id=$1 FOR UPDATE) o WHERE p.user_id=$1 AND p.allowance_period IS DISTINCT FROM $cur RETURNING o.old`. Only if a row came back: insert `expire` (−old, key `expire:{userId}:{prev}`, skipped when old = 0 or prev null) and `grant` (key `grant:{userId}:{cur}`). Concurrent callers block on the row lock and then match zero rows. Period = UTC month (documented: resets at 05:30 IST on the 1st). No cron, no rollover.
3. **Cost:** 1 credit only when the engine makes a model call.
4. **Debit (atomic, idempotent):** one transaction: `INSERT INTO credit_txn (…, key 'scan:{scanId}') ON CONFLICT DO NOTHING RETURNING id` → no row ⇒ already charged, return OK; else `UPDATE profile SET credits = credits - 1 WHERE user_id=$1 AND credits >= 1 RETURNING credits` → no row ⇒ throw `NO_CREDITS` (rolls back the txn row); set `balanceAfter`, `scan.charged = true`.
5. **Refund (idempotent):** one transaction: `INSERT credit_txn (key 'refund:{scanId}') ON CONFLICT DO NOTHING RETURNING id`; only if inserted → `UPDATE profile SET credits = credits + 1`. Triggered by any failure after charging (model error, timeout, unreadable, not food) and only when the conditional terminal `UPDATE scan` actually hit a row. A refund landing after a monthly reset can put the balance 1 above the allowance — accepted.
6. **Stuck scans:** on read, `queued|processing` with `createdAt` older than **3 min** (> `maxDuration` 60 s + margin, so the function is certainly dead) → `failed`/`TIMEOUT` + refund. All terminal writes are conditional (`UPDATE scan … WHERE id=$1 AND status IN ('queued','processing')`), so a late job can never overwrite a swept scan and a swept scan can never be completed; refund key `refund:{scanId}` makes double refunds impossible. No cron.
7. **Barcode is decided synchronously, before any charge.** Barcode hit with complete data → `done`, free. Barcode miss/incomplete: if no images → `done` with `errorCode BARCODE_NOT_FOUND` (free; UI asks for a label photo); if images → continue as an AI scan, which requires a credit (402 `NO_CREDITS` if balance 0, returned before the scan row is created).
8. **Guards (all counted in Postgres from `scan` rows):** per-user 5 scans/60 s → 429; per-user **25 model-calling scans per UTC day, refunded or not** → 429 (stops refund-loop abuse); global `DAILY_AI_SCAN_CAP` = count of `scan` rows with `charged = true` and `createdAt` ≥ start of UTC day → 503 `SERVICE_BUSY` (no charge); Google Cloud budget alert $5 (manual).
9. Pure logic (`logic.ts`): `currentPeriod`, `needsReset`, `allowanceFor`, `canStartScan` — unit-tested.

---

## 5. Nutrition core (`lib/nutrition`, pure — shared by catalogue foods and scans)

### 5.1 Portions
- Units: `g`/`ml` (ml≈g unless density known), `serving` (label serving size), `pack` (pack size), `household` (katori, roti, cup, glass, piece, tbsp, tsp, slice — from `food.portions`).
- `food.portions` built at seed/creation: source portions (FNDDS household measures, INDB serving size, label serving/pack) + Indian household defaults by food group from `data/sources/portions-in.csv` (katori 150 g, roti 40 g, idli 40 g, dosa 80 g, glass 250 ml, cup 150 ml, tbsp 15 g, tsp 5 g).
- `nutrientsFor(food.per100, grams) = per100 × grams / 100`. Portions with `grams: null` (e.g. a label giving only per-serving values with no serving size) can't be logged by unit; the UI offers grams instead, and scan confidence is `low` with a hint.
- ml-based foods: `grams` stores the gram-equivalent (density 1.0 unless the source gives one); labels show ml.

### 5.2 Daily targets
- Presets (adult reference-intake style; not body-metric personalised; no medical claims): `general` 2000 kcal · protein 60 g · carbs 275 g · fat 67 g · fibre 30 g · sugars ≤ 50 g · sodium ≤ 2000 mg. `weight_loss` 1700 kcal; `muscle` protein 100 g; `low_sugar` sugars ≤ 25 g; `low_sodium` sodium ≤ 1500 mg.
- Any target overridable (`profile.targets`). Onboarding step 4 shows the preset for editing.
- `DailyTargets = { energyKcal, protein, carbs, fat, fibre, sugarsMax, sodiumMgMax, satFatMax }` (numbers). `ScoreComponent = { key, label, points, maxPoints, direction: 'negative'|'positive', estimated: boolean, approximate?: boolean }`.
- `totals.ts`: per day and per meal; `remaining` for "aim for" targets, `over by` for "limit" targets (sugar, sodium, sat fat).

### 5.3 Grades (deterministic; `gradeVersion` bump ⇒ background recompute via script)
- **Algorithm choice is by `gradeCategory`** (set in `classify.ts`): INDB recipes and meal scans → `dish`; INDB raw ingredients, oils, ghee, salt, spices, sugar → `none` ("Not graded"); FNDDS → `dish` for mixed dishes (FNDDS category codes for mixed dishes/soups/sandwiches), `beverage` for drinks, else `general`; OFF/crowd → from categories (`en:beverages` → beverage, `en:waters` → water, `en:fats`/oils → fat_oil, `en:cheeses` → cheese, else general); custom foods → `dish` if per-serving entry, else `general`.
- **Packaged & generic foods:** Nutri-Score 2023 algorithm → points → A–E. v1 implements the **general foods** and **beverages** tables (plain water = A). Fats/oils/nuts and cheese use the general table in v1 and are marked `approximate` in the grade components (their dedicated tables are v1.1); fruit/veg/legume % estimated from ingredient order when not printed (component marked `estimated`). Processing modifier: NOVA 4 (OFF) or ≥ 3 additives / ultra-processed markers → at most one grade down, with reason. `gradeValue` 0–100 = linear map within grade band.
- **Dishes (`gradeCategory = dish`):** graded on the frozen `gradePortionGrams` (INDB serving size; FNDDS first household portion; meal scans = estimated grams; fallback 250 g): start 100; penalties sodium > 600 mg, sugars > 15 g, satFat > 7 g, energy > 700 kcal (scaled); bonuses protein ≥ 20 g, fibre ≥ 6 g; bands ≥80 A, ≥65 B, ≥50 C, ≥35 D, else E. Constants in one file.
- **One grade everywhere:** the stored neutral grade is shown in search, detail, history and logs. Goals don't change the grade; they produce `goal` flags ("High sodium for your low-sodium goal: 21% of your limit per bowl"). Goal-weighted grades are deferred.

### 5.4 Personalisation
- Goal notes: compare the default portion against the user's targets (sodium/sugar/satFat > 20 % of a limit, energy > 35 % of target) → `goal` flags with severity `note`.
- Allergens: `food.allergens` ∪ ingredient keyword map (synonyms incl. Hinglish: groundnut→peanut, maida/atta→gluten, paneer/ghee→milk) vs `profile.allergies` → flags `contains` / `may_contain`.
- Diet rules per diet (jain: onion, garlic, potato, root veg…; vegan: milk solids, ghee, honey, gelatin, E120…; vegetarian/eggetarian accordingly).
- Copy always ends "Check the pack to confirm." Dishes with unknown ingredients get no flags (stated as "ingredients unknown").

### 5.5 Explain
Template reasons from grade components + flags, ordered by impact, top 3 surfaced ("High sodium · 963 mg/100 g · 48% of your daily limit per pack"). No LLM.

---

## 6. Food catalogue & search (`lib/foods`)

### 6.1 Seed data (`pnpm seed:foods`, idempotent on `(source, sourceRef)`)
| Source | What | Size | License |
|---|---|---|---|
| **INDB** — Indian Nutrient Databank (2024), `INDB.xlsx` from github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB- | 1,014 Indian recipes: per-100 g nutrients + a named serving (`servings_unit`, e.g. "tea cup") with per-serving nutrients (serving grams = 100 × serving kcal ÷ kcal). Recipes only — raw ingredients come from IFCT, which isn't redistributable. | ~1k | CC BY 4.0 — attribution |
| **USDA FNDDS** (FoodData Central, `FoodData_Central_survey_food_json_2024-10-31.zip`, 3.7 MB) | 5,432 foods "as eaten", nutrient numbers 208/203/205/204/269/291/606/307, `foodPortions` with `gramWeight`, WWEIA category for classification | ~5.4k | CC0 |
| **Open Food Facts** | **India subset bulk-imported at fetch time** from the daily Parquet export (`hf://datasets/openfoodfacts/product-database/food.parquet`, queried with DuckDB: `'en:india' IN countries_tags` and usable nutriments — the search API is rate-limited and was returning 503 during review), refreshed by re-running the seed; at runtime only single-barcode lookups (`/api/v2/product/{code}`, cached, OFF limit ~100 req/min) for barcodes not in our DB. **No runtime OFF search** (OFF limits search to 10 req/min per IP, and Vercel IPs are shared) — front-of-pack matching and alternatives query our own `food` table only. | ~10–40k | ODbL — attribution; we display, don't redistribute the DB |
| **Crowd** | packaged products created from user scans | grows | ours |
| **Custom** | user-created or "Save to my foods" from a scan, private | — | user's |

INDB ships as a spreadsheet; `scripts/fetch-sources.ts` downloads each source and converts it to normalised CSV/JSONL under `data/sources/` (committed, with `ATTRIBUTION.md`), so seeding never depends on third-party uptime.

IFCT 2017 not used (raw ingredients only; commercial data licensing unclear; INDB builds on it). `aliases-in.csv` adds Hinglish/Hindi names (chawal, aloo, sabzi, dahi, chai…). Seeding computes grades and portions.

### 6.2 Search (Postgres only)
1. Normalise with the same `normalise()` used at write time (lowercase, NFD diacritic strip, punctuation strip, alias expansion).
2. Candidates: `searchText @@ websearch_to_tsquery('simple', q)` OR `q <% searchName` (word-similarity operator, index-backed; `pg_trgm.word_similarity_threshold = 0.4` set per transaction) — handles prefixes ("dal" → "dal tadka") and typos ("biriyani", "panner"); visible = `visibleFoodWhere(userId)` (non-custom + own custom, `deletedAt IS NULL`).
3. Rank: own recents/custom → exact/prefix name → `kind ≠ ingredient` (raw ingredients last, so "rice" returns cooked rice before "rice, raw, milled") → country match → source priority (IN: custom > crowd > indb > off > fndds; elsewhere fndds before indb) → popularity → word_similarity.
   Ranking is pinned by a fixture test of the top 50 Indian queries (`tests/fixtures/search-in.json`: query → expected first result).
4. `FoodHit { id, name, brand?, kind, grade, defaultPortion: {label, grams, kcal}, source }`.
   Seeding dedupes near-identical names within a source and drops FNDDS rows whose normName exactly matches an INDB row for IN users' ranking (kept for others).
5. Target p95 < 150 ms warm on Neon free at ~50k rows (cold start excluded). Empty query → Recents (from `user_food_stats`).

### 6.3 Custom foods
Create with name, brand?, "per" amount (serving or 100 g), nutrients, optional portions; converted to per-100 g; graded per §5.3. "Save to my foods" from any scan result copies it into a custom food. Delete = soft delete (`deletedAt`); existing log entries keep their snapshots.

---

## 7. Scanning engine (`lib/engine`)

`runEngine(input, deps): Promise<EngineOutput>` — orchestration only; nutrition logic from `lib/nutrition`.

```ts
EngineInput { barcode?; images: {mime; data: Uint8Array}[] (0–3, compressed client-side); profile }
EngineDeps  { findFoodByBarcode(code); fetchOffByBarcode(code); searchFoods({name, brand, country, category?});  // searchFoods = our DB only
              searchAlternatives({categories, country, betterThan}); extract(images, {model:'fast'|'strong', repairHint?}); now() }
EngineOutput { food: FoodDraft | {existingFoodId}; scan: ScanResult; usage? }
```

### 7.1 Pipeline
| # | Step | Paid? | Details |
|---|---|---|---|
| 0 | Client prep | — | Live barcode detection: native BarcodeDetector where available (Chrome/Android), otherwise `zxing-wasm` (the primary path on iOS Safari/Firefox; lazy-loaded only on `/scan`); compress to 1600 px long edge JPEG q≈0.8; 320 px WebP thumbnail. |
| 1 | Barcode | free | Runs synchronously in the route, before any charge (§4 rule 7): `food` by barcode → else OFF product lookup → cache as `source='off'`. Complete per-100 facts ⇒ done, photos ignored (provenance `community`). |
| 2 | Triage + extract | 1 credit | One vision call (`fast`), structured output (§7.2): per-image kind + quality + extracted data. |
| 2b | Front-of-pack | free | No panel: `searchFoods(name, brand, country)`; accept if name similarity ≥ 0.8 and brand matches → provenance from the matched food; else model estimate → `estimate` + hint "Add a photo of the back for exact facts". |
| 2c | Meal | free | Model returns item names + grams; each item matched to catalogue via `searchFoods` (INDB/FNDDS) — matched items use catalogue per-100 (`reference`), unmatched use model estimate (`estimate`). |
| 3 | Merge | free | Label values override DB field-by-field; DB fills gaps; per-field provenance. |
| 3b | Validate | free | Checks below; fail → keep values, confidence `low`, hint "Some numbers look off — retake the label photo". (A repair call is deferred; the eval decides whether it's worth it.) |
| 4 | Grade, personalise, explain | free | `lib/nutrition` §5.3–5.5. |
| 5 | Alternatives | free | §7.4; skipped for A/B. |
| 6 | Persist | free | Upsert food per §3 "How scans become foods"; save scan result. |

**Validation (per 100):** energy ≈ 4P+4C+9F **or** 4P+4C+9F+2·fibre (labels differ on whether carbs include fibre; either passing is OK) within ±15 % (±20 kcal when < 100 kcal); each macro ≤ 100 g; sugars ≤ carbs; satFat ≤ fat; when both printed, saltG ≈ 2.5 × sodiumMg / 1000 ±10 % (if only one is printed, derive the other); kJ ≈ 4.184 × kcal ±5 %; per-serving ≈ per-100 × serving/100 ±10 %.

### 7.2 Extraction schema (zod → structured output)
```ts
Extraction {
  images: { index; kind: 'barcode'|'nutrition_panel'|'ingredients'|'front'|'meal'|'not_food'|'unreadable';
            quality: ('blurry'|'glare'|'cropped'|'too_dark')[] }[]
  barcodeText?: string
  product?: { name; brand?; variant?; categoryGuess?; packSize?: {value; unit} }
  facts?: { basis: 'per_100g'|'per_100ml'|'per_serving'; servingSize?: {value; unit};
            energyKcal?; energyKj?; protein?; carbs?; sugars?; addedSugars?; fat?; satFat?; transFat?; fibre?; sodiumMg?; saltG? }
  ingredients?: string[]   // printed order, English-normalised
  allergensDeclared?: string[] · mayContain?: string[] · additives?: string[]
  meal?: { items: { name; grams; estimate: Nutrients }[] }
  printedLanguage?: string
}
```
Per-serving → per-100 conversion in code. Prompt: transcribe, don't judge; leave unknown fields empty (except explicit meal/front estimates). **Label text is untrusted data:** the prompt says so; output is schema-constrained (no tools); strings are length-capped in the zod schema (name ≤ 120 chars, ≤ 80 ingredients × ≤ 80 chars, ≤ 20 meal items) and numbers range-checked (0 ≤ macro ≤ 100 per 100 g, energy ≤ 900 kcal/100 g).

`FoodDraft` = the insertable subset of `food` (no `id`, `popularity`, `searchText`).

### 7.3 Model layer
- `MODEL_FAST` default `gemini-3.1-flash-lite`, `MODEL_STRONG` default `gemini-3.5-flash` (both stable ids, verified 2026-10-06; Gemini 2.5 retiring). `pnpm eval` also tries newer Flash releases and Claude Haiku 4.5; final choice by eval.
- AI SDK `generateObject`; low temperature where supported.
- **Time budget:** one overall deadline of 50 s per scan, passed down as an `AbortSignal`; each model call gets `min(25 s, remaining)`; at most 1 retry, only for 429/5xx/network/timeout and only if ≥ 15 s remain; never retry 4xx/safety/schema failures. Route `maxDuration = 60`.
- Usage → tokens + `costMicros` (price table per model id). Provider swap (Claude Haiku 4.5, Qwen3-VL via OpenRouter) = package + env.

### 7.4 Alternatives
Same category (OFF tags or `categoryGuess` mapped), `countries` ∋ user country, grade strictly better; **`food` table only** (no runtime OFF search); rank by grade then popularity. Store top 5; Basic shows 1. No match → static category tip ("Roasted chana or makhana are lower in fat and sodium"). Also shown on catalogue food detail pages for packaged foods.

### 7.5 Scan result
```ts
ScanResult {
  foodId; kind: 'packaged'|'dish'|'meal'
  items?: { name; grams; foodId?; nutrients; provenance }[]      // meals
  facts: Record<NutrientKey, { value; unit; provenance }>; basis
  grade; gradeValue; components; reasons[]; flags[]; ingredients?: {text; flagged}[]
  alternatives: { foodId; name; brand?; grade; imageUrl? }[]; tip?
  hints: string[]; confidence: 'high'|'medium'|'low'
}
```
Confidence: `high` = DB-complete barcode or label passing all checks; `medium` = front matched by name, or meal with all items catalogue-matched; `low` = any unmatched estimate or checks still failing.

---

## 8. API (`/api/v1`)

JSON; Better Auth session cookie. Errors `{ error: { code, message } }` with fixed user-safe messages.

| Method & path | Input | Success | Errors |
|---|---|---|---|
| `GET /me` | — | `{ profile, credits, plan, allowance, periodResetsAt }` (applies lazy reset) | 401 |
| `GET /foods?q=&limit=20` | q ≥ 2 chars | `{ results: FoodHit[] }` | 400, 401 |
| `GET /foods/recent` | — | `{ results: FoodHit[] }` (20) | 401 |
| `GET /foods/:id` | — | `{ food, reasons, flags, alternatives }` (visible foods only; alternatives from our DB) | 401, 404 |
| `POST /foods` | custom food (§6.3) or `{ fromScanId }` (own, done scan) | `201 { food }` | 400, 401, 404 |
| `PATCH /foods/:id` · `DELETE /foods/:id` | own custom only | `200` · `204` | 401, 404 |
| `GET /log?date=` | YYYY-MM-DD (default: today in `profile.timezone`) | `{ date, entries[], totals, byMeal, targets, remaining }` | 400, 401 |
| `POST /log` | `{ date, meal, portion }` + one of `foodId` · `scanId` (done, owned) · `{ name, nutrients }` | `201 { entry }` (nutrients computed server-side; client-sent nutrients only accepted for quick add, range-checked) | 400, 401, 404 |
| `PATCH /log/:id` | `{ meal?, portion?, date? }` | `200 { entry }` | 400, 401, 404 |
| `DELETE /log/:id` | — | `204` | 401, 404 |
| `POST /scans` | multipart `images[]` (0–3, each ≤ 1.2 MB, jpeg/webp/png verified by magic bytes, not the claimed MIME), `thumbnail?` (≤ 80 KB webp), `barcode?` (digits, valid EAN-8/13 or UPC-A check digit) — ≥ 1 of images/barcode; whole body ≤ 4 MB (Vercel limit is 4.5 MB). Client targets ~400 KB/image. | `202 { scanId, status }` / `200 { scanId, status:'done' }` (barcode sync) | 400 `INVALID_INPUT`, 401, 402 `NO_CREDITS`, 413 `TOO_LARGE`, 429 `RATE_LIMITED`, 503 `SERVICE_BUSY` |
| `GET /scans?cursor=&grade=&q=` | — | `{ scans[], nextCursor }` | 401 |
| `GET /scans/:id` | — | `{ id, status, result?, errorCode?, createdAt, thumbnailUrl? }` (stuck sweep; thumbnail = signed single-object GET, 10 min TTL) | 401, 404 |
| `DELETE /scans/:id` | — | `204`; a scan still `queued/processing` is first marked `failed` via the conditional update (refund applies), so the job's later write is a no-op | 401, 404 |

Server actions (UI-only): profile/onboarding/targets update, delete account, join waitlist.

Logging/search are free. Logging bumps `user_food_stats` and `food.popularity`.

**Validation & authz rules (all routes):** every query goes through `lib/authz.ts` helpers scoped by the session `userId` — `GET /foods/:id`, `POST /log {foodId|scanId}`, `POST /foods {fromScanId}`, `GET|DELETE /scans/:id`, `PATCH|DELETE /log/:id`, `PATCH|DELETE /foods/:id` — each with an integration test proving another user's id returns 404 — a foreign id returns 404, never 403, to avoid leaking existence. `date` must be a valid `YYYY-MM-DD` within [server UTC today − 365 days, server UTC today + 1 day] (covers every timezone). Portions: `grams` 1–5000. Quick-add nutrients: energy 0–5000 kcal, macros 0–500 g, sodium 0–20000 mg. Search `q` 2–60 chars.

**POST /scans flow:** auth → size/magic-byte/zod validation → rate limits → lazy reset → barcode path (sync, free; may finish here with 200) → no images? → 200 `BARCODE_NOT_FOUND` → global + per-user daily caps → balance check (402) → **one transaction: create `scan(queued)` + debit** → 202. Then `after()`: thumbnail → R2 (non-fatal) → conditional `processing` → `runEngine` with 50 s deadline → conditional terminal write (`done` + persist food) or (`failed` + refund). The thumbnail is uploaded with `Content-Type: image/webp` after verifying the RIFF/WEBP header. `maxDuration = 60`.

**Client:** TanStack Query polling 2 s while non-terminal; optimistic diary mutations; invalidate `me` after scans.

**User-facing error codes:** `NO_CREDITS`, `RATE_LIMITED`, `DAILY_LIMIT`, `SERVICE_BUSY`, `BARCODE_NOT_FOUND`, `UNREADABLE_IMAGE`, `NOT_FOOD`, `MODEL_ERROR`, `TIMEOUT`, `INVALID_INPUT`, `TOO_LARGE` — each one fixed sentence + recovery action; post-charge failures always say "Your credit was refunded."

---

## 9. Auth, privacy, security
- Better Auth Google only, `trustedOrigins` = `BETTER_AUTH_URL`; `proxy.ts` does an **optimistic** session-cookie check for `(app)` routes (redirect to `/sign-in`); the authoritative check is `requireUser()` in every server component, server action and route handler; profile ensured by `ensureProfile()` (§4 rule 1); timezone captured from the browser on first visit; first visit without `onboardedAt` → `/onboarding`.
- Full-size images never stored (memory only); 320 px thumbnail at R2 `u/{userId}/{scanId}.webp`, short-lived signed URLs.
- Delete account (server action): delete R2 objects by listing `u/{userId}/` and batch-deleting (retry-safe: listing again finds the rest), then delete the user row; FKs cascade to profile, scans, food_log, user_food_stats, credit_txn, waitlist, sessions/accounts and custom foods. Crowd foods remain (no user link, no user images).
- `lib/env.ts` zod-validated at boot; no `NEXT_PUBLIC_` secrets. **Rotate the old Gemini key** (in git history, commit `4d2b34c`).
- Gemini paid tier for real users (free tier may train on inputs, and its ~15 RPM limit makes bursts fail).
- Cost view: SQL view `daily_ai_cost` (date, scans, refunds, sum costMicros) for a quick `psql` check; no admin UI in v1.
- Disclaimers: informational, not medical advice; allergens "check the pack". `/about/data` attribution (INDB CC BY, USDA FDC, OFF ODbL). OFF requests send `User-Agent: EATRi8/2.0 (<contact>)`.

---

## 10. Testing & quality
- **Unit (offline):** portions, targets, totals, grades (Nutri-Score reference examples; dish rules), personalisation (allergen synonyms, diets), explain ordering, credits logic, validation checks, merge precedence, per-serving→per-100, search normalisation/aliases, `runEngine` with fakes for barcode-hit / label / front-matched / front-unmatched / meal (matched + unmatched items) / unreadable / not-food.
- **Integration (local Postgres via Docker or Neon branch):** concurrent debit with balance 1 → exactly one succeeds; refund idempotency; monthly reset; stuck sweep; search ranking fixtures ("rice" → boiled rice before rice flour; "panner" → paneer; other users' custom foods never returned); log totals.
- **Eval (`pnpm eval`, manual, costs money):** 25–30 fixtures (Indian + international packs, Hindi/regional labels, blurry/angled, fronts, meals) → per-field accuracy (±5 %), schema-failure rate, triage accuracy, p50/p95 latency, cost/scan per model.
- **CI:** ESLint 9 (0 warnings), `tsc --noEmit`, `vitest run` with a Postgres 17 service container (integration tests), `next build`.

---

## 11. Environment variables
| Var | Required | Source |
|---|---|---|
| `DATABASE_URL` | yes | Neon → pooled connection string (used with the WebSocket Pool driver); locally `postgres://eatri8:eatri8@localhost:5432/eatri8` from `docker compose up db` |
| `BETTER_AUTH_SECRET` | yes | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | yes | `http://localhost:3000` / prod URL |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | yes | Google Cloud Console OAuth (Web); redirect `{BETTER_AUTH_URL}/api/auth/callback/google` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | yes (milestone 2) | Google AI Studio — new key |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | yes (milestone 2) | Cloudflare R2 bucket + token |
| `MODEL_FAST`, `MODEL_STRONG`, `DAILY_AI_SCAN_CAP` (300), `OFF_CONTACT_EMAIL` | no | defaults in code |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | no | Sentry |

---

## 12. Delivery milestones (input to the implementation plan)
**M0 — Mock dry run (done):** clickable prototype, direction **B · Clean** chosen (Geist; type scale 12·13·15·17·22·30·40; spacing 4·8·12·16·20·24·32; accent #15803D / dark #4ADE80; radius 8/12/18). Reference copy: `docs/design/mock.html`. Visual polish continues during build.

**M1 — Tracker (no AI, ₹0 to run):**
1. Scaffold v2 (wipe old files; Next 16, Tailwind v4, shadcn, lint/test/CI, env schema, PWA manifest).
2. DB schema + migrations; Better Auth Google; profile + onboarding.
3. `lib/nutrition` (portions, targets, totals, grades, personalise, explain) — TDD.
4. Food catalogue: fetch + seed INDB + FNDDS + OFF India + portions/aliases; search, recents, food detail, custom foods.
5. Food log + Today (with date switcher) + Me/Settings.

**M2 — Scanning:**
6. Credits module (logic + ledger) + credits page + waitlist.
6b. Eval spike: 10 fixtures through the raw extraction call on 2–3 models before locking the extraction schema.
7. Engine (schema, validate, merge, model layer, OFF source, alternatives) — TDD with fakes.
8. Scans service + routes + R2 thumbnails + scan UI + History (Scans).
9. Eval harness + fixtures → pick models.

**M3 — Launch polish:** Sentry, error states, empty states, accessibility pass, privacy/terms/attribution, Lighthouse mobile pass, deploy.

**M4 — Workout tracker (post-launch):** exercise catalogue from free-exercise-db (public domain, 800+ exercises with images, self-hosted copies), workouts → exercises → sets (reps/weight/duration), calories burned via MET values, "Exercise" section on Today and net calories. Separate spec.

## 13. Open items (non-blocking)
- **Before public launch:** Vercel Hobby is non-commercial — choose Vercel Pro (~$20/mo) or Cloudflare Workers (OpenNext) free tier.
- Final pricing/allowances; Pro payments (Razorpay).
- Goal-weighted grades, a repair call for failed validation, fats/oils/cheese Nutri-Score tables (v1.1).
- Natural-language quick add (LLM parse onto catalogue items) — Pro or 1 credit.

## 14. Review log (rev 3)
Fixes applied after review on 2026-10-06:
1. `unaccent()` is not IMMUTABLE → search columns are app-maintained (superseded wrapper idea).
2. Upload caps fit Vercel's 4.5 MB body limit (≤ 1.2 MB × 3 + 80 KB thumb, ≤ 4 MB total); magic-byte checks.
3. Open Food Facts search is rate-limited (10/min/IP) → India subset bulk-imported; runtime = barcode lookups only.
4. Monthly reset serialised by row lock + idempotent keys; stuck sweep at 3 min with conditional terminal writes (no late-job overwrite, no double refund).
5. Barcode decided before charging; `BARCODE_NOT_FOUND` is free.
6. Log entries are self-contained snapshots; FKs `ON DELETE SET NULL`; meal scans don't create foods.
7. Nutri-Score v1 = general + beverages tables; fats/oils/cheese marked approximate.
8. Explicit authz (404 on foreign ids), date window, numeric ranges, label text treated as untrusted data.
9. History retention gating cut from v1.
10. Undefined types defined (`DailyTargets`, `ScoreComponent`, `FoodDraft`).
11. Workout tracker scheduled as M4.

### Rev 4 (independent adversarial review, 2026-10-06)
12. Interactive transactions → Neon WebSocket Pool driver; Docker Postgres for tests/CI.
13. Model time budget: one 50 s deadline, ≤ 25 s per call, ≤ 1 retry; repair call cut.
14. Debit/refund idempotent via `INSERT … ON CONFLICT DO NOTHING RETURNING` before touching the balance; reset via conditional UPDATE.
15. Charge happens last (scan row + debit in one transaction right before 202); thumbnail upload moved into `after()` and non-fatal.
16. Central authz helpers + per-route foreign-id tests.
17. Custom foods soft-deleted; crowd foods only from high-confidence scans; provenance split into reference / community / label / estimate.
18. Per-user daily cap on model-calling scans (refund-loop abuse).
19. Search uses word-similarity (`<%`) on name+aliases; raw ingredients demoted; top-50 Indian query fixture test.
20. Explicit `gradeCategory` per source; ingredients "Not graded"; dish grades on a frozen reference portion; one neutral grade everywhere, goals → flags.
21. `profile.timezone` for "today"; credit period is UTC month (documented).
22. Portions with unknown grams; ml density; salt/sodium formula fixed; energy check accepts both fibre conventions.
23. `ensureProfile()` instead of relying on an auth hook; first grant via lazy reset.
24. Cuts: Bearer plugin, goal-weighted grades, repair call, `mixed` input kind, units setting, History "Days" segment.
