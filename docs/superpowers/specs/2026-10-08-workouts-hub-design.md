# EATRi8 v2, Phase 2 addendum: the Workouts hub

Status: approved in the visual companion on 2026-10-08. Mockups: `.superpowers/brainstorm/94168-1791444706/content/` (`workouts-layout.html`, `workouts-full-v3.html`, `chart-stack-or-switch-v2.html`). It builds on the Phase 2 spec (`2026-10-08-phase-2-design.md` §B and §C) and replaces §C screen 6 ("Progress → Food | Fitness").

## What the user asked for

- A dedicated Workouts route instead of a tab inside Progress.
- Workout icon tiles in the lime brand accent, not blue.
- A first-visit setup on the Workouts page that asks for height, weight and similar details.
- History shown only once the user has worked out.
- On desktop, workout history in the left column, not the right rail. Today's Workouts card also moves out of the rail.
- Charts:
  - a calendar coloured by day type, plus "how often" per type (option A);
  - a weekly volume line chart, in the same card as the calendar behind a **Calendar | Volume switch** (option B);
  - weekly and monthly stats, including total volume and the top 3 exercises.
- Built so the stats can be sold as Pro later.

## Navigation

- **New route `/workouts`.** It's a top-level page with the phone bottom nav shown. `/workouts/*` keeps hiding it, as today.
- **Phone bar:** Today · Workouts · Scan · Progress · Me.
  - History leaves the phone bar.
  - On phones it's reached from Me (a new "Scan history" row with a count) and from the existing History links.
- **Desktop sidebar:** Today · Workouts · Progress · Foods · History. The Workouts row uses a Dumbbell icon.
- **Progress goes back to food only.**
  - The Food | Fitness switch is removed.
  - `/progress?view=fitness` redirects (307) to `/workouts`.
  - The Food view's workouts card links to `/workouts`.
- **Back from workout screens.** The `/workouts/*` screens use `/workouts` as their Back fallback. That covers `/workouts/new`, `/workouts/session`, a workout's summary and edit, and `/weight` when opened from the hub. Deleting a workout replaces the screen with `/workouts`.
- **`/workouts/new` stays** as the full picker (presets, Empty session, Other activity). The hub's Start buttons go straight to `/workouts/session?preset=…`.

## Look

- **Icon tiles.** Every workout and activity icon tile uses `IconTile tone="brand"` (`bg-brand-soft text-brand-deep`). The `protein` tone stays for nutrition only.
- **Day-type colours**, from existing tokens so both themes work:

  | Day type | Token |
  |---|---|
  | Push | `--brand` |
  | Pull | `--protein` |
  | Legs | `--warn` |
  | Back | `--carbs` |
  | Shoulders | `--fat` |
  | Activity | `--muted` at 70% |
  | Empty (custom) gym session | `--brand-deep` at 60% |

  - These colours are used in the calendar, the week dots, the legend and "How often".
  - A legend always sits under the calendar, so colour is never the only cue.
  - Each calendar cell also has an aria-label, for example "Tue 14 Oct, Pull day".

## First-visit setup

- **When it shows.** On `/workouts`, while `profile.fitness_onboarded_at` is null, the page shows a one-screen setup.
- **Fields:**
  - Height: cm, whole number, 100–250, optional.
  - Current weight: kg, one decimal, 20–400, optional.
  - Goal weight: kg, optional, 20–400.
  - Workout days a week: chips 1–7, defaulting to the stored value (3).
- **Continue** saves:
  - height and goal weight to the profile;
  - the weekly goal;
  - the weight as today's `body_weight` row, which recalculates burn (I1).

  It then sets `fitness_onboarded_at = now()` and shows the hub.
- **"Skip for now"** sets `fitness_onboarded_at` too. The setup never comes back, and everything stays editable in Me → Fitness. Me → Fitness gains the height field.
- **Copy:** title "Set up your training". Sub-line: "Your weight makes calorie burn accurate. You can change these anytime in Me."
- **Data:** migration 0011 adds `profile.height_cm smallint null` (CHECK 100–250) and `profile.fitness_onboarded_at timestamptz null`. It backfills `fitness_onboarded_at = now()` for every profile that already has a workout or a weight row, so existing users never see the setup.
- **API:** `POST /api/v1/me/fitness/setup` takes `{ heightCm?, weightKg?, goalWeightKg?, weeklyWorkoutGoal }` and is owner-scoped. `PATCH /api/v1/me/fitness` also accepts `heightCm`.
- **Height use.** Height is stored only. Nothing displays it outside Me yet; BMI is a later option.

## The /workouts page

Header: "Workouts" plus a **Week | Month** switch. Month carries a Pro chip when it's locked.

### States

| State | What's shown |
|---|---|
| Not set up | The setup above. |
| Set up, no workouts ever | The goal card ("0 of N workout days", "Your first session starts the streak"), "Start a session" preset tiles (Push, Pull, Leg, Back, Shoulders, Empty), an Other activity row and the weight card. No history, no stats, no charts. |
| Has at least one workout | The full page below. |

### Full page, desktop (≥ the current two-column breakpoint)

- **Left column, wide:**
  1. **Up next** card, with Other activity (ghost) and Start (lime).
  2. **Trends card (Pro)**, with a Calendar | Volume switch in its header:
     - **Calendar:** the current calendar month, Monday first. Each day is coloured by the type of its first gym session that day, or Activity if it only had activities. Today is outlined. The header says "{N} workout days".
     - **Volume:** the weekly volume line for the last 8 Monday–Sunday weeks.
       - The y-axis is fitted to the data: rounded min and max, with a little padding.
       - Every week has a point, and the current week has a larger point labelled with its value.
       - A dashed line marks the 8-week average.
       - The big number is this week's volume, with its change against last week.
       - Chips: Best, Avg, and Trend (first week to this week, %).
     - The chosen tab is remembered in `localStorage` (`eatri8-trends-tab`), defaulting to Calendar.
  3. **Top exercises (Pro):** the 3 exercises with the most done sets in the period. Ties go to more volume, then to the name.
     - Each row shows: rank, name, "{sets} sets · {sessions} sessions · best {kg} × {reps}", an 8-week sparkline of the weekly best estimated 1RM, and "e1RM {kg}" with its change against the previous period.
  4. **History:** all workouts, newest first, paged with "Show more" (20 at a time). Each row links to its summary.
- **Right column, 300 px:**
  1. Goal ring card (viewfinder tokens, as today).
  2. Week dots, coloured by day type.
  3. Stat tiles, 2 × 3, for the period:
     - Workout days
     - Total time
     - Calories burned
     - Volume
     - New PRs
     - Goal streak (consecutive Monday–Sunday weeks with the goal met, counting back from the current week if it's met, else from last week)

     Each tile shows its change against the previous period.
  4. **How often (Pro):** sessions per day type in the period, as horizontal bars.
  5. Weight card, linking to `/weight`.

### Phone

One column, in this order:
1. Goal
2. Up next
3. Trends card (switch)
4. Top exercises
5. Stat tiles
6. How often
7. Weight
8. History

### Periods

- **Week** is the current Monday–Sunday in the user's timezone. It's compared with last week up to the same weekday.
- **Month** is the current calendar month. It's compared with the previous month over the same day span (1st to today's day number, clamped to that month's length).
- The calendar always shows the current month, and Volume always shows 8 weeks, whatever the switch says.
- Volume follows the existing rule: Σ weight × reps over done sets. Soft-deleted workouts never count.

## Pro gating

- **New feature key:** `fitnessInsights` in `lib/credits/plan-features.ts`. Basic is false, Pro is true. It goes through `allows()`, so with `PRO_GATES_ENFORCED` off (the default) everyone sees everything.
- **Pro:** the Month period, the Trends card, Top exercises and How often.
- **Free:** the Week tiles, goal, week dots, up next, history and weight.
- **When locked (Basic with the gates on):**
  - The Pro cards render as **one** blurred preview card with the title "See your trends with Pro" and the line "Volume over 8 weeks, your top exercises, the monthly calendar and how often you train each day type."
  - The preview has a "See Pro" button, which opens the existing upgrade sheet.
  - The preview is rendered from static sample data, never the user's data.
  - The Month toggle shows the Pro chip and opens the upgrade sheet.
- **API:** `GET /api/v1/fitness/stats?range=week|month`.
  - It's owner-scoped.
  - For a locked user, `range=month` returns `403 PRO_REQUIRED`.
  - For a locked user, `range=week` returns the free fields, with the Pro fields (`calendar`, `volumeWeeks`, `topExercises`, `byType`) set to `null`.

## Today

The Workouts card moves out of the desktop insights rail into the main column, under the meals, at every width. It's rendered once, no longer twice with `md:hidden`. The rail keeps Week and Recent scans.

## Out of scope

- BMI and any use of height.
- Sex and age (not asked).
- Calendar navigation to other months.
- Per-exercise history pages.

## Tests

- **Unit, `lib/fitness/insights.ts` (pure):**
  - period bounds and previous-period spans (month clamping, for example 31 March against February);
  - the day-type pick (first gym session wins, activity only, empty session);
  - 8-week volume buckets, including empty weeks;
  - the top-3 ranking and its tie-breaks;
  - weekly best-e1RM series;
  - goal streak (current week met or not, gaps);
  - deltas;
  - fitted y-axis bounds.
- **Int:**
  - `GET /fitness/stats` owner scoping;
  - soft-deleted workouts excluded;
  - the gates (month 403, week with Pro fields null for Basic when enforced, everything open when not enforced);
  - the setup endpoint (saves fields, logs weight, sets `fitness_onboarded_at`, skip path);
  - the migration backfill.
- **UI audit scenarios:**
  - `/workouts` in its not-set-up, empty and full states;
  - Basic locked;
  - phone and desktop, both themes;
  - the Trends switch on each tab;
  - Today with the moved card.

  All with 0 offenders.
- **Demo seed:** at least 8 weeks of varied sessions, so every chart is populated.

## Delivery

Built on the `phase-2` branch and shipped in the same single PR as Phase 2 ("one PR"). The PR opens after this addendum's final review and full verification.
