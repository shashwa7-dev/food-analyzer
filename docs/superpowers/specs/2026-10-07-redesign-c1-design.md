# EATRi8 v2: Redesign C1 "Lime & Ink"

**Status:** draft for review · **Date:** 2026-10-07
**Visual source of truth:** `docs/design/mock-c1.html`, also published at https://claude.ai/artifact/BdFcUiU5bVY1oyNpW4KGe8
**Builds on:** `2026-10-06-eatri8-v2-design.md`. M1 and M2 are complete on branch `v2`.

## 1. Goal

Reskin the whole app in the C1 Lime & Ink direction, which the user chose from a reference shot, and add the screens the mock introduced:
- a **Progress** tab with charts
- a full-page **food search**
- a **scan flow** that shows review and progress
- a simplified **Me** page and a **credits** page

Behaviour, data and money logic stay the same except where this spec says otherwise.

**Success means:**
- Every screen in the mock exists in the app and matches it at 390 px and 1280 px wide, in light and dark mode.
- No button wraps onto two lines.
- All existing tests still pass, and the new aggregation code is tested.

## 2. Out of scope

| Item | Why |
|---|---|
| Photo storage (R2) and the photo-on-top "Food details" screen | The user parked it ("storage is an issue for now"). The scan result keeps the grade-card hero. `scan.thumbnail_key` stays unused. |
| Food images in search (Open Food Facts or generated) | Parked with storage. Rows use category icon tiles. |
| Workout tracker | M4. Progress only shows a "Workouts · Coming soon" card. |
| Weight logging and trend | Not built. There is no chart for it. |
| Notifications | The bell in the mock is decorative. Leave it out. |

## 3. Design rules (apply everywhere)

1. **Buttons never wrap.** Every button, chip, tab and pill is `white-space: nowrap`. If text doesn't fit at 360 px, shorten the copy or let an icon carry the meaning. Review rejects any wrap. This rule comes from the user.
2. **Icons generously.** Use lucide icons, which the project already uses, on buttons, list rows, stat tiles, chips, flags and meal rows. They are decorative: `aria-hidden`, and the text label carries the meaning.
3. **Lime is a fill, never text.** Lime text on white fails contrast. Text accents use `--brand-deep`. Text on a lime fill uses `--brand-ink`.
4. **Grade colours mean A–E only.** Macros get their own colours, which never reuse the green-to-red grade scale.
5. **One main action per sheet or screen.** The primary button is solid ink (black in light mode, lime in dark mode). Secondary actions are ghost buttons on `--sunken`.
6. **Tap targets are at least 44 px.** Keep the existing rule.
7. **Charts:** each has an `aria-label` plus a visible one-line takeaway where the mock shows one. Colours come from tokens only.
8. **Motion** (spinner, scan laser, pulse) respects `prefers-reduced-motion`.

## 4. Tokens (`app/globals.css`)

Replace the current palette. Token names stay where they exist, so existing components restyle automatically.

**Light mode:**

| Token | Value | Notes |
|---|---|---|
| `--bg` | `#FAFBF6` | page ground |
| `--wash-a` → `--bg` | `#EEF4DA` → `#FAFBF6` | new: a vertical wash in the top ~45% of app screens |
| `--surface` | `#FFFFFF` | cards and sheets |
| `--sunken` | `#F1F3EC` | ghost buttons, steppers, inactive chips |
| `--line` | `#E4E8DC` | |
| `--ink` / `--muted` | `#12150F` / `#646B5E` | |
| `--brand` | `#A6D84A` | lime: fills, scan button, rings, bars |
| `--brand-soft` | `#E3F2C2` | calorie card, credit strip, selected meal |
| `--brand-deep` | `#4D7A12` | text and icon accents, ring progress on soft |
| `--brand-ink` | `#12150F` | text on lime |
| `--action` / `--action-ink` | `#12150F` / `#FFFFFF` | primary buttons, active chips, toasts |
| `--protein` / `--carbs` / `--fat` | `#2E7CF6` / `#7A5AF8` / `#D6408F` | `--fat-soft` `#FBE3EF` for hatching |
| `--warn` | `#B86E00` | low credits, sodium line |
| `--g-a`…`--g-e` | unchanged | Nutri-Score colours |

**Dark mode** (same tokens, under both the media query and the class, as today):
- `--bg` #11140F, `--surface` #1A1E17, `--sunken` #20251C, `--line` #2A3124, `--ink` #EDF1E6, `--muted` #9AA290
- `--brand-soft` #26331A, `--brand-deep` #B9E36E
- `--action` = `--brand`, `--action-ink` #12150F
- macros #5C9BFF / #9B85FF / #F06AAE, `--warn` #F0A43A
- shadows: none

**Shape:**
- Radii: cards 24 px, small cards 20 px, sheets 30 px at the top, buttons and chips 999 px (pill), icon tiles 12–15 px.
- Card shadow: `0 1px 2px rgb(20 26 12 / .05), 0 8px 24px rgb(20 26 12 / .06)`.

**Type:**
- Geist stays.
- Large titles are 30–40 px, weight 650, tracking −0.04em, using the existing `.title`.
- Numbers use `.num`, which is tabular.
- Uppercase labels are 12 px with +0.06em tracking.

shadcn/Base UI components keep their structure. Only their tokens and radii change, plus a `pill` button size where needed.

## 5. Navigation

**Phone (bottom nav):** Today · **Progress** · Scan · History · Me.
- Scan is a raised 60 px lime circle with a 6 px `--bg` ring.
- The bar is a floating white pill (28 px radius) with safe-area padding.
- **Foods** leaves the phone nav. It's reached from every "+" and from the empty state.

**Desktop (≥ 900 px) sidebar, 252 px wide:**
1. Logo.
2. **Scan food**: a full-width lime pill with a `S` key hint. Pressing `S` opens /scan when focus isn't in an input.
3. Nav: Today, Progress, Foods, History. History shows a count of scans.
4. A credits card at the bottom:
   - "N scans left", "of 20 · resets 1 Nov"
   - a 20-block meter
   - the rules "Barcodes are free" and "Label or meal photo uses 1"
   - an outline "Join Pro waitlist" button
5. **Low state** (3 or fewer left): the card turns amber, the subtitle becomes "barcodes still free", and the button turns solid with "Get more with Pro". Both buttons link to the waitlist.
6. A profile row: avatar, name, plan and a gear icon, linking to /me.

## 6. Screens

The mock has each screen. Notes here cover only behaviour that the mock can't show.

### 6.1 Today (`/today`)
- **Header:** avatar initials, "Hi, {first name}", the date, and a round calendar button that opens the date picker sheet.
- **Headline:** "You have **{n} kcal** left today". When over target: "You're **{n} kcal** over today". On a past date: "{n} kcal left on {date}".
- **Calorie card** (`--brand-soft`): "Eaten" with a flame icon, the eaten kcal, "of {target} target", and a ring showing % of goal. The ring is capped visually at 100% and shows the true % as text.
- **Macro tiles:** three tiles (Protein, Carbs, Fat), each with its icon, a bar and "{eaten} / {target} g".
- **Meal cards:** a meal icon tile (sunrise, sun, cookie, moon), the name, an items summary (ellipsised), "{kcal} kcal" with a flame, and a round "+" that opens food search for that meal. An empty meal shows a dashed card reading "Nothing logged yet".
- **Entries:** tapping a meal card expands to its entries, keeping the M1 behaviour. Tapping an entry opens the edit sheet.

### 6.2 Food search (`/foods`, full page)
- **Opening it:** from "+", with `?meal=&date=` deciding where entries go. The title reads "Add to {Meal}", with the date below.
- **Search box:** autofocused, with a 2 px `--brand-deep` focus ring and a barcode button that opens /scan in barcode mode.
- **Tabs:** Results, Recent, My foods, Quick add. These map to the existing M1 features.
  - Results appear only when there's a query.
  - With no query, Recent is the default tab.
- **Rows:** a category icon tile, name, "{portion} · {grams} g", kcal, a grade badge and a round quick-add button.
  - **Quick add** logs the food's default portion straight away and shows a toast: "{Food} added to {Meal}" with **Undo**. Undo deletes the entry.
  - **Tapping the row** opens the add-food sheet.
- **Category icon tiles:** a pure function from food fields to a lucide icon, tested. Packaged foods (source `off`, or a barcode) get package. Beverages get cup-soda. Otherwise keyword rules on the name and `categories` pick bowl (dal, curry, rice), wheat (roti, bread), milk, egg, apple, or cookie (snacks, sweets), with utensils as the fallback. No images; see §2.
- On desktop, the same page is centred, about 720 px wide.

### 6.3 Add food sheet (bottom sheet; a dialog on desktop)
- **Head:** an icon tile, the name, the source ("Home-style · INDB"), and the grade.
- **Amount stepper:** "−" and "+" step by the unit's natural increment (½ for katori, bowl and piece, 10 g for grams). It shows "1½ / katori · 225 g".
- **Unit chips:** the food's portions plus Grams.
- **Meal tiles:** four, with icons. The meal passed in is preselected.
- **Live macros:** a row showing kcal, protein, carbs and fat.
- **Personal flags:** allergen and diet warnings from M1 show as flag chips above the button.
- **Primary button:** "Add to {Meal}".

### 6.4 Edit entry sheet
- Same layout as the add-food sheet.
- The head shows the logged time and a round red delete button. Delete asks for confirmation with the dialog in §6.6, then shows an "Undo" toast.
- A Meal field (a select).
- Buttons: Cancel / Save.
- Entries logged by grams keep the M1 behaviour of being edited in grams.

### 6.5 Date picker sheet
- Month grid starting on Monday, with prev/next arrows.
- Days with food logged get a dot. This needs one cheap query: the distinct logged dates for the visible month.
- Future days are muted and can't be selected; this keeps the existing allowed-date rule.
- Buttons: "Today" / "Go to {d Mon}".

### 6.6 Confirm dialog
- Centred, with an icon tile, a title, one honest sentence about the consequence, and "Keep it" / a red action button.
- Use it for deleting a scan, deleting an entry and deleting the account. Account deletion keeps its type-DELETE field inside the dialog.
- **Delete-scan copy:** "It disappears from your history. Foods you logged from it stay in your diary. The scan still counts toward this month's 20."

### 6.7 Toast
- Ink pill at the bottom, above the nav.
- Shows a check icon, the message (ellipsised) and an optional action button (Undo).
- Restyles the existing `sonner` toast, not a new system.

### 6.8 Scanner (`/scan`)
- A full-screen camera with round white back and close buttons and the title "Scan".
- Corner brackets, and a lime laser line in barcode mode.
- A hint pill:
  - Barcode: "Point at a barcode"
  - Label: "Fit the nutrition table inside the frame"
  - Front: "Show the front of the pack"
  - Meal: "Get the whole plate in"
- **Mode tiles:** Barcode, Label, Front, Meal. They're frosted, and the active one is white.
  - The mode only changes the hint and the expected image slot. Barcode detection keeps running in every mode, as now.
- **Bottom row:** a gallery button, a 78 px shutter, and a credits badge (sparkle icon plus the number left).

### 6.9 Review photos (new step)
- Shown after at least one capture in Label, Front or Meal mode. A barcode hit still goes straight to the result.
- **Tray:** numbered thumbnails (up to 3), each removable, plus an "add" slot. These are in-memory blobs only.
- A hint line suggests what else to capture.
- **Primary button:** "Analyse photos", with a "1 scan" cost chip (sparkle icon).

### 6.10 Analysing (replaces the current progress view)
- The blurred last photo sits behind a card titled "Analysing your photos", with "Usually 5–10 seconds" underneath.
- Four steps: reading the table, matching ingredients and allergens, grading for your goals, finding better options.
  - **The steps are cosmetic.** They advance on a timer (0 s, 2 s, 4 s, 6 s) and are never shown as finished before the result arrives. Real status still comes from polling.
- Footer: "If this fails, your scan is refunded."
- The existing "Still working" message after 65 s stays.

### 6.11 Scan result (`/scans/[id]`)
- A top bar with back and close.
- Tag chips: category, pack size and scan type, each with an icon.
- Title.
- **Grade hero:** a large grade tile, a verdict line, a one-line reason and the A–E scale with the current grade raised.
- **Calorie row:** "590 kcal per 100 g" plus a typical portion ("30 g = 177 kcal").
- **Macro rings:** three, each showing % of calories from that macro.
- **Flags:** allergen, sodium and diet flags as icon chips.
- **Better pick:** the first alternative, as a tappable row with a green tint.
- **Actions:** "Save food" (ghost, bookmark icon) and "Add to {Meal}" (solid, plus icon), which opens the add-food sheet.
- **Delete:** sits in the top-bar overflow and uses the confirm dialog.
- Failed scans keep the M2 copy, inside the same card style.

### 6.12 Progress (`/progress`, new)
- **Header:** "Progress" with a Week / Month toggle. Week is the last 7 days ending today; Month is the last 30.
- **KPI tiles:** average kcal (over days with entries), days on target ("4/6"), and the logging streak. Desktop adds average protein.
- **Charts** (EvilCharts, see §7):

| Card | Chart | Data |
|---|---|---|
| Calories | composed: a bar per day plus a dashed target line; over-target bars hatched in `--fat`; today's bar uses `--brand-soft` | daily kcal |
| Macro split | donut plus a legend with % of kcal | sum of protein×4, carbs×4, fat×9 |
| Nutrient balance | radar with 6 axes and a dashed 100% ring; a point over a limit turns red | protein, fibre, calories as % of target; sugar, sodium, sat fat as % of limit; average over days with entries; capped at 150 |
| Sodium | smooth line plus a dashed limit and a label on the maximum | daily mg |
| Food quality (desktop, and phone under Month) | donut of kcal share by grade A–E, plus "{x}% from A and B foods" | `food_log.grade` snapshot; ungraded entries left out |
| Workouts | static card: "Coming soon" and one sentence | none |

- **Takeaway line** under nutrient balance: the worst axis over its limit ("Sodium is 18% over your limit this week."), or "Everything within your limits this week."
- **Empty state:** with fewer than 2 days logged, show one card ("Log a couple of days to see your trends") with a "Log food" button. Hide the charts.

### 6.13 Me (`/me`, simplified)
- "Me" title.
- Avatar, name and email as plain text, with no card.
- **Credit strip** (`--brand-soft`): "18 of 20 AI scans left", a thin bar and "Basic · resets 1 Nov". It links to /me/credits.
- **Settings list:** one card, four rows, each with a plain muted icon, label, current value and a chevron:
  - Goal: "Lose weight · 2,050 kcal"
  - Diet
  - Allergies ("None" when empty)
  - Country
- **Editing:** each row opens a sheet holding the matching part of the existing settings form. Goal holds goal plus the daily-targets fields. The form logic is reused; only the layout changes.
- **Footer:** "Sign out" on the left; a small red "Delete account" on the right, which opens the confirm dialog.
- On desktop, the same single column is centred at max 560 px.

### 6.14 Credits (`/me/credits`)
- Top bar "Scan credits".
- **Chart card:** "18 of 20 left", plus a step-area chart of the balance per day this period, with a dot on each scan and refund, a dashed flat projection to the period end, and a "Today · N" label.
- **Stat tiles:** used, free barcodes, refunded.
- **Filter chips:** All, Used, Free, Refunds.
- **Activity:** grouped by day (Today, Yesterday, then "5 Oct"). Each row shows:
  - a type icon tile
  - what was scanned (the product name, or "Couldn't read photo")
  - "{type} · grade X"
  - a pill: "−1", "Free" (lime) or "+1" (green)
- Rows link to the scan when it isn't deleted.
- The monthly grant shows as a quiet row: "October allowance +20".
- **Plans** (Basic, Pro waitlist) move below the activity, unchanged.
- **Data:** joins `credit_txn` to `scan` for names and types. Free barcode scans come from `scan` rows with `charged = false`.

## 7. Charts library

- Use **EvilCharts** (MIT) with the **Recharts** engine, installed through its shadcn registry into `components/charts/`. The code is owned and editable.
- Don't use the ECharts engine; it's about 1 MB of canvas code we don't need.
- Expect Recharts 3.x and React 19; check that peer dependencies resolve on the project's versions.
- Charts render client-side inside `"use client"` wrappers. Data comes from server components or the API.
- Theme through the chart config's CSS variables, so dark mode works.
- If an EvilCharts variant doesn't exist for a need (for example the hatched over-target bar), customise the copied component rather than adding another library.

## 8. Data and API additions

- `GET /api/v1/progress?range=week|month` (auth, owner-scoped) returns:
  ```
  { days: [{ date, kcal, protein, carbs, fat, fibre, sugars, sodiumMg, satFat, entries }],
    targets, kpis: { avgKcal, daysOnTarget, daysLogged, streak, avgProtein },
    macroSplit: { protein, carbs, fat },   // % of kcal
    balance: { protein, fibre, energy, sugars, sodium, satFat },   // % of target/limit, capped at 150
    gradeMix: { A, B, C, D, E },   // % of graded kcal
    worstOverLimit: { axis, pct } | null }
  ```
  The Progress server component calls the same service directly.
- **Definitions:**
  - Day boundaries are in the profile timezone, using the existing date helpers.
  - **On target:** a day with entries whose kcal is between 90% and 110% of the calorie target. For a weight-loss goal the range is 80–100%. KPIs display "{on target}/{days logged}".
  - **Streak:** consecutive days with at least one entry, ending today. If today has no entry, it ends yesterday.
- **Aggregation:** one SQL query over `food_log` for the range, grouped by `date` (already the user's local date), using the per-entry `nutrients` snapshot. Grade mix uses `food_log.grade`, the grade snapshot taken when the entry was logged, so no join is needed.
- `GET /api/v1/log/dates?month=YYYY-MM` returns the distinct logged dates for the date picker.
- `GET /api/v1/credits/activity?filter=all|used|free|refunds&cursor=` returns grouped activity for /me/credits. The chart series is computed server-side from the ledger.
- **No schema changes** are expected. If one is needed, it comes as a migration with tests.

## 9. M2 leftovers to fold in

These come from `docs/superpowers/specs/m2-final-rereview.md`:
- **N1:** bound the Open Food Facts lookup by the scan deadline.
- **N2:** retry `cacheOffFood` once on 23505.
- **N3:** re-point stats and log entries at the twin before deleting a crowd row.
- **N4:** lock running scans before the profile in `deleteAccount`.
- **N5:** read the pepper through `env()`, warn on the fallback in production, and prune old tombstones.
- **N6:** keep unmapped OFF allergen tags.
- **N9:** fix the entry-sheet "View scan" flicker.
- **N10:** time the 65 s "Still working" message from the scan's `createdAt`.
- **N11:** add a tombstone test for a fully used allowance.
- **Skipped:** N7, because there's no production data, and N8, because the pieces are already covered.

## 10. Testing and acceptance

- **Unit tests:** progress aggregation (on `food_log`) (on-target ranges, streak across the timezone boundary, capped balance, grade mix leaving out ungraded entries, worst-axis selection), the category-to-icon map, the stepper increments and the activity grouping.
- **Integration tests:** the `/progress`, `/log/dates` and `/credits/activity` endpoints, owner scoping, and the M2 leftover fixes.
- **Visual check:**
  - Headless-Chrome screenshots of every screen in §6 at 390×844 and 1280×800, light and dark, signed in through a seeded test user, compared by eye against the mock.
  - A small script that asserts no `button, [role=button], a.btn` element is taller than its single-line height. It runs over the same pages.
- **Unchanged:** lint, typecheck, unit tests, integration tests and build stay green. The money invariants from M2 stay as they are.

## 11. Order of work (the plan will split this into tasks)

1. Tokens, globals, the shadcn component restyle, the icon map, the nav and sidebar.
2. Today, plus the sheets, dialog, toast and date picker.
3. The food search page and the add/edit sheets.
4. Scanner, review photos, analysing and the scan result.
5. EvilCharts setup, then the Progress API and screen.
6. Me, credits activity and the credits page.
7. M2 leftovers.
8. Visual QA pass and the button no-wrap audit.
