# M2 Scanning: re-review of the final fix wave

Range `9f958ea..0bb22dd` (branch `v2`, 7 commits). Inputs: `final-review.md`, `final-fix-report.md`, the controller's rulings on I1–I4.

## Verdict: **Ready**

| Severity | Count |
|---|---|
| Critical | 0 |
| Important | 0 |
| Minor (new) | 5 |
| Nit (new) | 6 |

All four Important findings are fixed and tested with tests that assert real behaviour. The money invariants are intact. The new issues are low-probability or cosmetic, and none of them touches charging or refunds.

## Checks run

| Check | Result |
|---|---|
| `pnpm lint` | pass |
| `pnpm typecheck` | pass |
| `pnpm test` | 39 files, 385 tests pass |
| `pnpm test:int` | 11 files, 132 tests pass |
| `drizzle-kit check` | "Everything's fine" |
| Fresh migrate on a throwaway DB (`eatri8_rereview_tmp`, created and then dropped) | 8 migrations (0000–0007) apply cleanly, in order |
| `drizzle-kit generate` against a copy of the migrations | "No schema changes": `schema.ts` matches the 0007 snapshot |
| Columns after 0007 | `credit_tombstone(email_hash text PK, period text, used int, day date, day_scans int, updated_at timestamptz default now())`; `profile.carried_day date NULL`, `profile.carried_day_scans int NOT NULL DEFAULT 0` |

The working tree was clean at the end. Nothing in the repo was modified.

---

## Important findings

### I1. Allergens and may-contain tags dropped on save: **Fixed**

- **What changed.** `ScanResult` now carries `allergens`, `mayContain` and `additives` as OFF tags (`lib/engine/result.ts:30-33, 150-152`). `buildResult` converts model keys and keeps OFF tags it doesn't map. `createCustomFoodFromScan` copies all three (`lib/foods/service.ts:233`), and `updateCustomFood` leaves them alone.
- **Tests.** `lib/foods/service.int.test.ts` saves a result and runs `foodDetail` for a user allergic to peanut and tree nut.
  - It asserts `peanut: contains` and `tree_nut: may_contain`.
  - It asserts the flags equal those of a curated food with the same tags.
  - Unit tests check the tag conversion.
- **Caveat.** The integration test builds the result with `buildResult` rather than running the namkeen fixture through `createScan`. `labelScan` passes its computed tags into `buildResult`, so the path is covered, just not end to end (see nit N8).

### I2. Per-serving labels with no serving weight: **Fixed**

- **Engine.** `per100` is `null`, with `perServing` holding the printed values (`lib/engine/index.ts:351`, the front path at `:386`). The result is ungraded and carries a "Not graded" reason (`result.ts:283-312`).
- **No crowd row.** `confidence` is `low` when `servingUnknown`, so no crowd candidate is built. That keeps per-serving numbers out of a shared per-100 row.
- **Portions.** The only portion is `{1 serving, grams: null}` (`index.ts:206`), so the UI can't offer a "pack" portion priced at one serving.
- **Logging** (`lib/log/service.ts:95-106`).
  - Only `kind: "scan"` is accepted, and nutrients = `perServing × quantity`.
  - `scan_grams` throws `InvalidError`.
  - A later quantity edit rescales by the amount ratio, because `grams` is null.
- **Saving.** `createCustomFoodFromScan` throws `InvalidError` (`service.ts:221`), which the route maps to 400 (`app/api/v1/foods/route.ts:38`), and the UI hides the button (`scan-result-view.tsx:157`).
- **UI.** `AddToMeal` hides Custom g/ml and computes kcal from `perServing`.
- **Tests.** The Masala Oats fixture runs end to end and checks:
  - 160 kcal / 420 mg for 1 serving and 320 / 840 for 2;
  - a quantity edit to 1.5 gives 240 / 630;
  - grams are refused;
  - save is refused and creates no food row.

Meets the ruling.

### I3. A model-read barcode claiming a shared crowd mapping: **Fixed**

- **Tri-state OFF lookup** (`lib/engine/off.ts:179-218`).
  - `not_found` is returned only for HTTP 404, or HTTP 200 with `status: 0`.
  - These all return `unavailable`: a thrown fetch (network error, DNS failure, our 6 s abort), non-404 HTTP errors, bad JSON, a body with no product, a product too incomplete to use, and an invalid code.
  - Every class is covered in `off.test.ts`.
- **Timeouts don't count as a miss.** In `runAi`, `crowdBarcode = found || offMiss ? barcode : null` (`index.ts:305`), and `offMiss` is true only on `not_found`. A submitted barcode carries `resolveBarcode`'s `offNotFound` through `createScan` → `completeScan` → `runAi`. A model-read barcode now goes through the same curated-then-OFF lookup (`lookupBarcode`, `:240-246`). A timeout or outage leaves the crowd row without a barcode, and both the unit and integration tests assert this.
- **Never a free barcode answer.** `findFoodByBarcode` excludes `crowd` (`lib/foods/service.ts:118`), so a barcode-only scan of a crowd-held code goes to OFF.
  - If OFF has no product, the scan ends as `BARCODE_NOT_FOUND`.
  - With photos, it takes the charged AI path. The integration test asserts 202 and 19 credits.
  - Other paths that can return a crowd row are name matches: `frontScan` and `labelScan`'s `matchByName`. Both are charged and capped at `medium` confidence. No free, high-confidence path remains.
- **Curated holder.** When a curated food holds the code, the candidate keeps it. The upsert is a no-op because of `setWhere source='crowd'`, and `result.foodId` falls back to that food (this also fixes M7).
- **Two users scanning the same new barcode.** Both get `not_found`, and both upserts target `food_barcode_uq` with `ON CONFLICT DO UPDATE … WHERE source='crowd'`. Postgres serialises the second insert behind the first, and it becomes a refresh. You end up with one row, and no error.
- **Crowd row gives up its barcode, or is deleted.** `cacheOffFood` (`lib/foods/insert.ts:384-392`) handles this.
  - It first deletes a barcoded crowd row that has a barcode-less twin, then nulls the barcode on any remaining crowd holder, then upserts the OFF row, all in one transaction.
  - The FKs that point at `food` are `food_log.food_id` and `scan.food_id` (both `set null`) and `user_food_stats.food_id` (`cascade`).
  - Diary entries keep their snapshot. `scan.result.foodId` (JSON) may then dangle, but `addScanEntry` re-checks with `getFoodForUser`, so the entry is just not linked, and no UI links to `result.foodId`.
  - The cascade on `user_food_stats` drops recents (see N3).
  - There is one narrow race (see N2).

Meets the ruling.

### I4. Account deletion resetting the allowance and the daily cap: **Fixed**

- **Tombstone.** `deleteAccount` records it in the same transaction as the user delete, after `FOR UPDATE OF p` on the profile, so an in-flight debit is serialised with it (`lib/profile/service.ts:62-67`, `lib/credits/tombstone.ts:31-56`).
  - It stores `used = allowance − credits` for the current period, so refunds count as unused.
  - It stores `dayScans` = charged scans today (refunded ones included) plus any count already carried.
  - Repeat deletions in the same period or day keep the larger value (`GREATEST`).
- **Seeding.** This happens only on the first-ever grant (`allowance_period IS NULL`). The grant becomes `max(0, allowance − used)`, under the same profile lock and the same `grant:{userId}:{period}` key (`lib/credits/ledger.ts:55-68`). Today's carried count goes into `profile.carried_day*`, and `dailyCapHit` adds it (`lib/rate-limit.ts:38-49`).
- **The only deletion path.** `deleteAccountAction` is the sole caller. Better Auth has no `deleteUser` enabled; the only other user delete is the `search-smoke` script.
- **Tests** (`tombstone.int.test.ts`). They cover:
  - same email with different case and whitespace;
  - the daily cap today versus tomorrow;
  - repeat deletion (13 credits);
  - a different email, and the next month;
  - a user with no profile;
  - an assertion that no plaintext email appears in the stored row.
- **Timing safety.** No secret is compared in application code. The hash is used as an indexed equality key in SQL, and a client can't submit a hash or observe a comparison, so `timingSafeEqual` isn't needed.
- **Pepper.**
  - **Key.** It is HMAC-SHA256 keyed by `CREDIT_TOMBSTONE_PEPPER`, falling back to `BETTER_AUTH_SECRET`.
  - **Missing.** `emailHash` throws when neither is set. In a running app that can't happen: `env()` requires `BETTER_AUTH_SECRET` (≥ 32 chars), and `lib/auth.ts` calls `env()` at import. If both were missing, the first grant and account deletion would roll back. That fails closed, with no partial writes.
  - **Too short.** A pepper under 16 chars fails `env()` validation at boot.
  - **Rotation.** Rotating the pepper, or the auth secret when it's the fallback, orphans existing tombstones and fails open to a fresh grant. The README and fix report document this, and tell you to set a dedicated pepper. See N5 for the env-module bypass.
- **Email normalisation.** The email is trimmed and lower-cased. Gmail dots and `+tag` are **not** normalised, and the fix report doesn't say so. This is acceptable today because sign-in is Google-only (`lib/auth.ts`). Google returns one canonical address per account, and dot or plus variants aren't separate Google accounts, so they can't be used to dodge the tombstone. If email/password or magic-link login is added, dot or plus variants would bypass it; add a code comment saying so.
- **No PII.** The table holds only the hex HMAC and the counts. There is no FK and no user id. The privacy page is updated.

---

## Minor findings (original)

| # | Verdict | Notes |
|---|---|---|
| M1 | Fixed | One key per photo-set signature and code (`scan-flow.tsx:69-75, 93`). `NETWORK` offers `RETRY_ACTION`, which calls `submit(problem.kind)` with the same photos, so the key is the same and the server replays the scan. There's no UI test, but the logic is simple. |
| M2 | Fixed | `/me/credits` calls `sweepStuck(userId)` before `getBalance`. The nav and Today still self-heal only on scan reads, which is the option the review allowed. |
| M3 | Fixed | The message changes after 65 s. See N10: the timer starts at mount. |
| M4 | Fixed | `failed = status === "failed" \|\| errorCode !== null`. |
| M5 | Skipped. Acceptable | It's a product decision about validation semantics. |
| M6 | Fixed | `gradeFrozen: false` on edit. The int test asserts both states. |
| M7 | Fixed (in I3) | `foodId: barcodeFood?.id`. The int test now expects `offRow.id`. |
| M8 | Skipped. Acceptable | It needs a merge design. I3 removes the one twin case that OFF takes over. |
| M9 | Fixed | Logs the cause's `name`, `statusCode` and `message` (capped at 300 chars) for MODEL_ERROR and TIMEOUT. It never logs the request body. |
| M10 | Skipped. Acceptable | The review rated it acceptable for M2. Belongs with the budget-alert work. |
| M11 | Fixed | `SERVICE_BUSY` has no action. The unit test is updated. |
| M12 | Fixed | A "View scan" link appears. See N9 for a loading flicker. |
| M13 | Skipped. Acceptable | Drift risk only, in UI code that the redesign will rewrite. |
| M14 | Fixed (partly). Acceptable | `refundScanStandalone` is removed, its tests are moved to `refundScan` in a transaction, and the stale comment is gone. Keeping `thumbnail_key` avoids a migration that buys nothing. |
| M15 | Documented. Acceptable | The README says to always use `db:migrate` and never `push`, and gives the reason. |
| M16 | Fixed | The README intro, env heading, tombstone docs and the "Before launch" key-rotation item are all done. |
| M17 | Skipped. Acceptable | It's on the money path and was already deferred. The launch-scale assessment still stands. |

---

## Regressions: money invariants

All six hold. Only the first-grant amount changed.

| Invariant | Status | Evidence |
|---|---|---|
| Idempotency keys | Intact | `createScan`'s replay checks (pre-lock, under the lock, and the unique fallback) are untouched. The grant keeps `grant:{userId}:{period}`. The client now *reuses* keys, which only adds protection. |
| Debit before the model call | Intact | Debit and `scan(queued)` are still inserted in one locked transaction, and `schedule` runs only when `created`. The new OFF lookup in `runAi` happens after the debit, and any failure there goes to `failSafely`, which refunds. |
| Refund only charged scans | Intact | `failScanTx` and `refundScan` are unchanged. The only new caller is `sweepStuck` on `/me/credits`, and it goes through `failScanTx`. |
| `FOR UPDATE` serialisation | Intact | Debit, grant and reset run under the same profile lock. `deleteAccount` now also takes it. |
| Conditional terminal writes | Intact | The `completeScan` and `failScanTx` `WHERE status IN (…)` clauses are unchanged. |
| No double charge on replay | Intact | No server change. A client network retry now replays the same scan instead of creating a second one. |

The grant can now be 0 (when `used ≥ allowance`). `credit_txn` has no amount CHECK, and `credits_non_negative` holds, so the next debit gets the usual 402.

---

## New issues

### Minor

**N1. The OFF lookup for a model-read barcode isn't bounded by the scan deadline.**
- **Where:** `lib/engine/index.ts:116-117, 240-246`, `lib/engine/off.ts` (`TIMEOUT_MS = 6000`, no deadline or signal).
- **Scenario:** a slow label scan's model call returns at about 49 s of the 50 s budget. The new OFF lookup then takes up to 6 s, followed by alternatives queries and the crowd upsert. That runs past 55 s, close to `maxDuration = 60`. If the function is killed, the scan stays `processing` until the 3-minute sweep fails and refunds it. No money is lost, but a good result is.
- **Fix:** pass `min(6 s, deadline − now)` to `lookupOffByBarcode`. Or skip the OFF call when too little time remains, and treat the code as `unavailable` (no crowd barcode).

**N2. Race in `cacheOffFood`: a unique violation on `food_barcode_uq`.**
- **Where:** `lib/foods/insert.ts:384-392`.
- **Scenario:** user A's label job (with OFF `not_found` a moment earlier) is inserting a barcoded crowd row. Meanwhile user B's barcode scan gets OFF `found` and runs `cacheOffFood`. B's release `UPDATE` can't see A's uncommitted row. B's `INSERT … ON CONFLICT (source, source_ref)` then blocks on A's entry in `food_barcode_uq`, which isn't the arbiter index, and raises 23505 once A commits.
  - **B's barcode-only scan:** it's free, so the result is a 500 with no charge.
  - **Model-read barcode path:** that scan is MODEL_ERROR and refunded.
- **Likelihood:** it needs OFF to flip from "no product" to "has it" within one scan's window, so it's very unlikely.
- **Fix:** catch 23505 and retry the transaction once.

**N3. Dropping a barcoded crowd twin erases users' recents for it.**
- **Where:** `lib/foods/insert.ts:387-388`, `lib/db/schema.ts:177` (`user_food_stats.food_id … onDelete: "cascade"`).
- **Scenario:** several users logged the barcoded crowd row. OFF later gets the product and a barcode-less twin exists, so the row is deleted. Their diary entries survive (`set null`), but the food vanishes from their Recents and Frequent lists, and their stats aren't moved to the twin.
- **Missing test:** no test covers a log entry or stats row referencing the deleted row.
- **Fix:** before the delete, re-point `user_food_stats`/`food_log` at the twin with `UPDATE … SET food_id = twin.id`, or merge into the twin.

**N4. `deleteAccount` takes locks in the order profile → scan; `failScanTx` takes them scan → profile.**
- **Where:** `lib/credits/tombstone.ts:32-34` (profile `FOR UPDATE`), then `lib/profile/service.ts:66` (the cascade deletes and locks `scan` rows).
- **Scenario:** an AI job finishes or fails for the same user just as they confirm deletion. Postgres detects the deadlock and aborts one transaction.
  - If the delete aborts, the user sees an error and can retry.
  - If the job aborts, everything is deleted anyway.
- **Impact:** no money effect. The old single `DELETE user` already cascaded in a similar order, so this is mostly pre-existing; the explicit early lock widens the window a little.
- **Fix (optional):** lock the user's running scans first (`SELECT … FROM scan WHERE user_id = $1 AND status IN (…) FOR UPDATE`), then the profile.

**N5. Tombstone pepper handling: an env bypass, key reuse, and no retention limit.**
- **Where:** `lib/credits/tombstone.ts:18`, `lib/env.ts:15-16`.
- **Env bypass:** `process.env` is read directly, which breaks the global constraint that env vars go through `lib/env.ts`. Validation runs only because something else calls `env()`.
- **Key reuse:** the fallback keys the HMAC with `BETTER_AUTH_SECRET`, so one secret serves two purposes. Rotating it after a leak, which is the usual response, silently resets every tombstone.
- **Retention:** tombstones are never pruned. A keyed email hash is still pseudonymous personal data, and the privacy copy doesn't say how long it's kept.
- **Fix:** read the pepper through `env()`; in production, require a dedicated pepper or log a warning when the fallback is used; prune rows whose `period` is before the current one (they're never read again).

### Nits

- **N6.** `labelScan` passes DB tags through `toOffAllergenTags` (`lib/engine/index.ts:347-348`). That drops OFF tags it doesn't map (such as `en:celery`) when a label is merged with an OFF or DB food, so a food saved from that scan loses them. Personal flags aren't affected, because `personalise` only knows the mapped tags. Union `db.allergens.filter(isOffTag)` as `buildResult` does.
- **N7.** Scan rows stored before this wave with `servingUnknown` still hold per-serving numbers in `per100`, so they can still be logged by grams. This is fine pre-launch, since there is no production data. Add a guard (`servingUnknown && per100` → treat as `perServing`) only if any such rows could have shipped.
- **N8.** There is no end-to-end I1 test running the namkeen fixture through `createScan` → `createCustomFoodFromScan`. The `buildResult` integration test and the engine unit tests cover the pieces.
- **N9.** In the entry sheet, "View scan" shows while the linked-food query is loading, then swaps to "View food" (`components/today/entry-sheet.tsx:69-78`). Gate it on `!entry.foodId || linked.isError`.
- **N10.** The 65 s "Still working" timer starts when `ScanProgress` mounts (`scan-progress.tsx:21`), not at the scan's `createdAt`. Reopening a stuck scan restarts the 65 s.
- **N11.** There is no tombstone test for a fully used allowance in the same period, where the grant is 0 and the next scan gets 402. That's the exact scenario in the original I4. The code handles it (`max(0, …)`, no amount CHECK), but it isn't asserted.
