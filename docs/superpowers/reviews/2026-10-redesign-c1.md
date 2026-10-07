# C1 redesign: rulings, decisions and open questions

This page records the C1 "Lime & Ink" redesign (branch `redesign-c1`, PR #2). The working ledger and reviews stay in the git-ignored `.superpowers/` folder; this file is the part that belongs with the code. Spec: `docs/superpowers/specs/2026-10-07-redesign-c1-design.md`.

## Key rulings

- **Theme.** Dark is the default, with Light and System as the other options. The root layout is static with `data-theme="dark"`, and a blocking head script applies the saved cookie before paint. Users without JavaScript and a non-dark choice see dark, which is acceptable because dark is the default. The setting lives only in Me settings; the sidebar toggle was removed.
- **Pro gates are off.** The Pro-only features are 200 scans a month, the Progress month view, CSV export and custom daily targets. They are gated in code behind `PRO_GATES_ENFORCED`, which stays off until Pro launches.
- **Hatch band on Progress.** A bar is hatched only when it is outside the KPI's on-target band, for example over 110% for the general goal. A bar between 100% and 110% crosses the target line without a hatch.
- **Daily limits** (sugars, sodium, saturated fat):
  - over the limit is bad;
  - 90–100% is a warning;
  - exactly at the limit is not over;
  - a limit nutrient missing from an entry counts as unknown, never as 0. Today shows "300+ / 2,000 mg · 1 item unknown", and Progress says the data is incomplete instead of "within limits".
- **Provisional grade.** When a value the grade scores is dropped as implausible, the grade shows "?" with the reason ("Grade unavailable — sodium missing"), never a confident letter. A frozen grade (a scan saved to My foods) keeps its snapshot.
- **Plausibility bounds.** A per-100 value past its bound is unknown, never clamped. The bounds are:
  - 910 kcal;
  - 100 g for a macro;
  - 40,000 mg sodium;
  - a part within its whole plus max(1 g, 5%).

  Micronutrient bounds are tight on purpose, set at the richest real food, because Open Food Facts has many 1,000× unit slips. A custom food entered per serving with no weight is checked as one serving (5,000 kcal and 500 g a macro), because it is stored as if the serving were 100 g.
- **INDB vitamins.** Vitamin D is taken as D3 only, because INDB's D2 on plant foods is unreliable. Vitamin E is capped and footnoted. Open Food Facts micros under 1% of the Daily Value are dropped as noise.
- **Credits activity (M7).** A refunded scan's debit row is hidden. Its refund row shows a "Refunded" pill with the meta line "Credit returned" instead of "+1", so the visible rows add up to the balance.
- **Profile reads (M10).** Accepted as partly fixed. A page render no longer writes the profile, but Today still reads it several times. Caching it per request could serve a stale profile right after a save.

## User decisions

- **2026-10-07**
  - The Pro-only feature list above was chosen, with enforcement off. Plans appear first on the credits page.
  - A theme setting was added with Dark as the default.
  - The limits row has a heading: "Close to your daily limit" or "Over your daily limit".
  - The sidebar credits card is one line, and the scanner badge is a one-line pill.
  - The desktop Today layout is option A, with equal-height meal cards.
  - Cards get a hairline border in both themes, and the sidebar Scan item matches the nav rows.
  - The Today headline is smaller on phones, with more space between desktop tiles.
- **2026-10-08**
  - One PR from `redesign-c1` into master.
  - The visible Me title was removed but kept for screen readers.
  - History has grade chips with meanings, a "What do grades mean?" sheet, and a proper no-match state.
  - The food detail page uses layout C with every nutrient, micronutrients included.

## Skipped findings

| Finding | Why it was skipped |
|---|---|
| M4: a scan entry's frozen grade can come from a value its snapshot dropped | Covered by the frozen-grade ruling; the error is harsher, never flattering. |
| M12: the sidebar balance can be from before a refund | Not reproduced, and the fix would touch the refund sweep's ordering. |
| M13: vendored `recharts-brush` is unused | Still imported by the vendored charts. |
| M13: `fetchOffByBarcode` and `loadImages` are used only by tests and scripts | Kept for the scripts and eval that use them. |
| M14: input styles are inconsistent | Needs a design decision, not a code fix. |
| No `food_id` index for the food merge | Needs a migration, and the path is rare. |
| Crowd-food twin delete can race to an FK error | Not reproduced; the window is very narrow. |

## Open question

**M1, grandfathered custom targets.** Only writes are gated: targets a user saved before Pro launches keep applying to Today and Progress. When enforcement is turned on, the user decides whether to keep this grandfathering or to fall back to the goal's presets for Basic users.
