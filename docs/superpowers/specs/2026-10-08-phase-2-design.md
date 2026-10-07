# EATRi8 v2, Phase 2: scan photos, Pro gating, fitness tracker

**Status:** approved by the user on 2026-10-08 ("write the spec and start building").
**Builds on:** the merged PR #2 (M1 tracker, M2 scanning, C1 redesign) and the spec `2026-10-07-redesign-c1-design.md`.
**Visual source of truth:** `docs/design/mock-c1.html`, sections "Scan flow" (photo screens) and "Fitness". It is also published at https://claude.ai/artifact/BdFcUiU5bVY1oyNpW4KGe8#fitness.
**Out of scope:**
- payments (the user deferred them)
- wearable or health-app sync
- user-built routines, rest timers, and "eat-back" of burned calories
- images for catalogue foods

## A. Scan photos on Cloudflare R2

The user's choice is a display copy kept for 30 days plus a thumbnail kept with the scan.

### Storage
`lib/storage/r2.ts` defines a `PhotoStore` interface:

```ts
interface PhotoStore {
  put(key, bytes, contentType);
  signedGetUrl(key, ttlSeconds);
  deletePrefix(prefix);
  deleteKeys(keys);
}
```

- **Implementations:** an R2 one built on `aws4fetch`, and an in-memory fake for tests.
- **Enabling:** storage is on only when all four of `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET` are set. Read them as optional values through `lib/env.ts`. With storage off, every call is a no-op and the app behaves exactly as it does today.

### Keys
- Display copies: `display/u/{userId}/{scanId}/{n}.webp`
- Thumbnail: `thumb/u/{userId}/{scanId}.webp`

### Processing
- Use `sharp` inside the existing post-charge `after()`. A failure there is logged and never fatal.
- Make a 1080 px long-edge WebP for each photo (quality about 70, aim for 250 KB or less), plus one 320 px thumbnail from the first photo (aim for 40 KB or less).
- Never upscale. Apply EXIF rotation, then strip all metadata, including GPS.
- Only AI scans that have images get photos. Process only bytes that already passed magic-byte validation.
- Full-size originals are never stored.

### Database
- Migration 0008 adds `scan.photo_count int not null default 0` and `scan.photos_expire_at timestamptz null`.
- `scan.thumbnail_key` already exists.
- Set these columns after the uploads succeed, with a conditional update that never overwrites a terminal status.

### API
- `GET /api/v1/scans/{id}` adds `photoUrls: string[]` and `thumbnailUrl: string | null`. URLs are signed with a 10-minute TTL. `photoUrls` is empty when storage is off, when the photos have expired, or when there are none.
- `GET /api/v1/scans` adds `thumbnailUrl` per row.

### Deletion
- A soft-deleted scan has its objects deleted best-effort in `after()`.
- Account deletion removes both prefixes before the user row goes. Listing is retry-safe.

### Lifecycle
`scripts/r2-lifecycle.ts` (`pnpm r2:lifecycle`) sets a rule that expires `display/` after 30 days. It is idempotent and documented.

### UI
- **Scan result:** the photo hero, as in the mock's "Food details (stored photo)", shows when `photoUrls` is present. It includes an "N photos" chip and swipe or arrows between photos. Otherwise the grade-card layout stays.
- **History and Today's Recent scans:** rows show the thumbnail in place of the icon tile.
- **Privacy page:** "Photos from AI scans are kept for 30 days so you can see them in your history; a small thumbnail stays until you delete the scan."

### Tests
- **Unit:** key building, resize maths, metadata stripping on a fixture that has EXIF and GPS, and the disabled no-op.
- **Integration**, using the fake store:
  - an upload happens after the charge
  - a failed upload leaves the scan done and charged
  - the right URLs are returned
  - expired photos come back empty
  - soft delete and account deletion remove the objects
  - a barcode-only scan uploads nothing

## B. Basic vs Pro: gates on, waitlist only, no payments

### Launch switch
Turning Pro on is still the single `PRO_GATES_ENFORCED` value. This phase makes the enforced experience complete and good.

- Development enforces the gates when the env value is true. The app must work correctly in both modes.

### Pro-only features
The existing four stay as they are: 200 scans a month, the Progress Month view, CSV export and custom targets.

### Locked UI, when enforced and the user is on Basic
Every gated entry point shows a small `Pro` lock chip (Sparkles icon plus "Pro") and opens the **upgrade sheet** instead of doing the action. The entry points are:
- the Month toggle
- the custom-target fields
- Export
- the "200 scans" line

### Upgrade sheet
- A ResponsiveSheet that compares Basic and Pro. It reuses the plan-card content from `/me/credits`.
- Pro is listed as "Everything in Basic, plus…".
- The primary action is **Join the waitlist**, or "You're on the list" once joined. It reuses the existing waitlist action.
- It is reachable from every lock and from `/me/credits#pro`.

### Custom targets at launch (user decision)
When the gates are enforced, a Basic user's effective targets are the goal preset. Stored overrides are kept but ignored, so upgrading later restores them.

- Show a one-time dismissible notice on Today and Me: "Custom targets are now part of Pro. You're on your goal's preset targets."
- Record the dismissal in a new profile column, `notices jsonb not null default '{}'`, via migration 0009.

### CSV export (Pro)
- `GET /api/v1/export?what=diary|scans|workouts|weight` returns a CSV stream for the signed-in user.
- Columns are documented. Owner-scoped. Gated by `allows(plan, "dataExport")` with a 403 `PRO_REQUIRED` response.
- Me gets an "Export data" row that opens a small sheet with the four choices. A Basic user sees the lock while the gates are on.

### Dev-only
`scripts/plan-set.ts` (`pnpm plan:set <email> pro|basic`) uses the same local-only guard as `seed:demo`, so the Pro experience can be tested. There is no admin UI.

### Tests
- `allows` in both modes, with every lock path covered.
- The export route: owner scoping, 403 for Basic when enforced, and the CSV escaping (quotes, commas, newlines).
- The targets notice: shown once, then gone after dismissal.
- Effective targets when enforced.

## C. Fitness tracker v1 (gym-first)

### Data
Migration 0010 adds three tables:

- **`workout`**
  - Columns:
    - `id uuid`
    - `user_id`
    - `date date` (the user's local day)
    - `kind` enum `gym|activity`
    - `preset text null` (`push|pull|legs|back|shoulders`)
    - `title text`
    - `activity text null` (`walk|run|cycling|yoga|sport`)
    - `intensity` enum `easy|moderate|hard`
    - `started_at timestamptz`
    - `duration_min int`
    - `kcal_burned int`
    - `kcal_basis jsonb` (MET, weight used, and whether the weight was estimated)
    - `notes text null`
    - `created_at`, `updated_at`, `deleted_at`
  - Index on `(user_id, date)`.
- **`workout_exercise`**
  - Columns: `id`, `workout_id` (cascade), `position int`, `exercise_key text`, `name text`.
  - `exercise_key` refers to the static catalogue; custom exercises are allowed by name.
- **`workout_set`**
  - Columns: `id`, `exercise_id` (cascade), `position`, `weight_kg numeric(6,2) null`, `reps int null`, `done boolean`.
  - Only sets marked done count toward volume and PRs.

Another table, `body_weight`, holds `user_id`, `date`, `kg numeric(5,2)` and `created_at`, and is unique on `(user_id, date)`. A new log replaces that day's value.

Profile gains `weekly_workout_goal smallint not null default 3` (range 1–7) and `goal_weight_kg numeric(5,2) null`.

### Catalogue
`lib/fitness/catalogue.ts` is static data with tests:
- **Exercises:** key, name, muscle group and equipment, about 40 common gym lifts.
- **Five presets:**
  - **Push:** bench press, overhead press, incline DB press, lateral raise, triceps pushdown.
  - **Pull:** deadlift or lat pulldown, barbell row, seated cable row, face pull, biceps curl.
  - **Legs:** squat, Romanian deadlift, leg press, leg curl, calf raise.
  - **Back:** pull-up or lat pulldown, barbell row, single-arm DB row, straight-arm pulldown, back extension.
  - **Shoulders:** overhead press, lateral raise, rear-delt fly, upright row or Arnold press, shrug.
- **Activities:** walk, run, cycling, yoga, sport.

### Calories burned
`lib/fitness/burn.ts` computes `kcal = MET × weightKg × hours` and rounds the result.

| Activity | Easy | Moderate | Hard |
|---|---|---|---|
| Gym | 3.5 | 5.0 | 6.0 |
| Walk | 2.8 | 3.5 | 4.3 |
| Run | 7.0 | 9.8 | 11.5 |
| Cycling | 5.8 | 7.5 | 10.0 |
| Yoga | 2.5 | 3.0 | 4.0 |
| Sport | 5.0 | 7.0 | 9.0 |

- The weight used is the latest `body_weight` on or before that date. If there is none, use 70 kg and flag the result as estimated; the UI then shows "~" and suggests "Log your weight for a better estimate".
- Gym sessions use the session duration with Moderate intensity unless the user picks another.

### Derived values
`lib/fitness/stats.ts` holds pure functions, all tested:
- **Volume:** Σ weight × reps over sets marked done.
- **Best set per exercise:** by Epley e1RM, `weight × (1 + reps/30)`.
- **PR:** a best set that beats every earlier best for that `exercise_key`.
- **Previous values:** the matching set from the last workout that contained the exercise.
- **Up next:**
  - After Push the next session is Pull, after Pull it's Legs, and after Legs it's Push again.
  - After Back or Shoulders, or with no history, it's Push.
- **Weekly stats** for Monday to Sunday in the user's timezone: sessions, minutes, kcal and the set of days trained.
- **Weight change** over 30 days.

### API
All routes are owner-scoped and zod-validated, with soft delete. Workout writes are transactional.
- `POST /api/v1/workouts` creates a whole workout: exercises with sets, or an activity. `kcal_burned` is computed on the server.
- `GET /api/v1/workouts?from=&to=` returns a list. `GET /api/v1/workouts/{id}` returns one, with exercises, sets and PR flags.
- `PATCH /api/v1/workouts/{id}` edits the title, duration, intensity, notes and the full exercise and set list, then recomputes kcal. `DELETE /api/v1/workouts/{id}` soft-deletes.
- `GET /api/v1/fitness/summary?week=YYYY-MM-DD` returns the week strip, goal progress, minutes, kcal, up next and recent workouts.
- `GET|POST /api/v1/weight` and `DELETE /api/v1/weight/{date}`.
- `PATCH /api/v1/me/fitness` sets the weekly goal and the goal weight.

### Screens
These follow the mock; tokens, the no-wrap rule and 44 px targets all apply.

1. **Log workout** at `/workouts/new`: the gym presets list with exercise counts, an "Empty session" link, and an "Other activity" tile row.
2. **Live session** at `/workouts/session?preset=` (client):
   - **Header:** a timer, a set count, Finish, and a discard control behind a confirm.
   - **Exercise cards:** the name in brand-deep, "Last: 60 kg × 8", and set rows with Set, Previous, kg, Reps and a done tick. Inputs use the numeric keypad.
   - **Editing:** add a set, which copies the previous row; remove a set by swipe or the ⋯ menu; reorder or remove an exercise from the ⋯ menu; add an exercise through a searchable picker over the catalogue plus a custom name.
   - **Draft persistence:** the draft lives in `localStorage` under one key per user, so a reload or app switch doesn't lose it. A "Resume session" banner on Today shows while a draft exists.
   - **Finish:** posts the session, clears the draft and shows the summary.
3. **Summary** at `/workouts/{id}`:
   - Done hero, then minutes, sets, volume and kcal (with "~" when estimated).
   - An exercise list with best sets and PR badges.
   - Edit and Delete (behind a confirm). The calorie-burn note.
4. **Other activity sheet**, from the tiles: minutes stepper, Easy, Moderate and Hard, live "~kcal burned", and "Log {activity}".
5. **Today:**
   - **Energy strip:** shown only when today has at least one workout. It reads "Eaten − Burned = Net of {target}". The calorie target and headline stay unchanged; there is no eat-back. The headline may add "· 450 burned".
   - **Workouts card:** today's sessions, with a Log link. On phone it sits under the macro tiles; on desktop it goes in the rail slot already left for it.
   - The resume banner.
6. **Progress → Food | Fitness switch.** The Fitness view has:
   - the week strip with done, rest, today and future states
   - the weekly goal card ("3 of 5", with dots)
   - Time and Burned tiles for this week
   - Up next with a Start button
   - Recent workouts (the last 5, linking to the summary)
   - a weight card with the 30-day trend and goal line, linking to `/weight`

   The Food view is today's Progress, unchanged. The switch is kept in `?view=`.
7. **Weight** at `/weight`: current weight and 30-day change, a trend chart (EvilCharts line) with the goal line, a recent list, and Log weight (a sheet with a 0.1 kg stepper). Delete an entry with a confirm.
8. **Me:** a "Fitness" row for the weekly goal and goal weight, as a setting sheet.

### Gating
Fitness is free on both plans in v1.

### Tests
- **Unit:** the burn calculation for every MET cell and the estimated flag, volume, e1RM and PR, previous-values lookup, up-next rotation, and week bounds in IST.
- **Integration:** create, list, get, patch and delete a workout; owner scoping; recompute on patch; weight upsert on the same date; and a summary for a seeded week.
- **Audit** (`pnpm ui:audit`): `/workouts/new`, the live session with sets, the summary, the Today energy strip, Progress Fitness and `/weight`, at 390 and 1280 px, in dark and light.
- **Demo seed:** add three gym sessions and two walks over the past week, plus 30 days of weight entries.

## Order of work
1. **R2 photos (A).** This can be built and tested without credentials; live verification happens once the user adds the R2 env values.
2. **Pro gating (B).**
3. **Fitness data and API (C, data part).**
4. **Fitness screens (C, UI).**
5. **Fitness integration and QA:** Today, Progress, Weight, Me, the demo seed and the audit.

A review follows each task, and a whole-branch review comes at the end. The work lives on branch `phase-2`, with one PR into `master` when it's done.
