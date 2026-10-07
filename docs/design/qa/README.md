# UI QA screenshots

`pnpm ui:audit` (`scripts/ui-audit.ts`, checks in `scripts/lib/audit-probe.ts`) writes one PNG per
screen, width and theme here as `{page}-{width}-{theme}.png`. The PNGs are git-ignored; only this
README is committed. Compare them with the mock, `docs/design/mock-c1.html`.

## Run it

```bash
pnpm dev                    # in another terminal
pnpm seed:demo              # demo user + session cookie (.superpowers/demo-cookie.txt)
pnpm ui:audit               # every page, both widths, both themes; exit 1 on any offender
pnpm ui:audit --only scan,history --w 390 --theme dark --no-shots
```

Needs Google Chrome in `/Applications` (driven by `puppeteer-core`, with Chrome's fake camera for
`/scan`). The audit is read-only: it opens sheets and dialogs but never saves, deletes (the delete
confirm is cancelled with "Keep it") or completes onboarding.

## Viewports and themes

| Width | Viewport | Device |
|---|---|---|
| 390 | 390 × 844 @2x | mobile, touch |
| 1280 | 1280 × 800 @2x | desktop |

Themes are set with the `eatri8-theme` cookie, against the opposite OS scheme so the cookie must win:
`dark` (cookie dark, OS light) and `light` (cookie light, OS dark). `/today` is also shot with the
cookie on `system` under both OS schemes (`system-dark`, `system-light`).

Full pages are shot with the viewport stretched to the document height, so the bottom nav and sticky
action bars sit at the bottom; sheets, dialogs and the scanner are shot at the real viewport.

## Pages

| Name | Path | State |
|---|---|---|
| `today` | `/today` | |
| `today-system` | `/today` | System theme only |
| `today-entry-sheet` | `/today` | edit-entry sheet open |
| `today-delete-confirm` | `/today` | edit sheet, then the delete confirm (cancelled after) |
| `today-date-picker` | `/today` | date picker open |
| `foods-lunch` | `/foods?meal=lunch` | empty search |
| `foods-dal` | `/foods?meal=lunch` | "dal" typed |
| `foods-dal-sheet` | `/foods?meal=lunch` | "dal", first result's add sheet open |
| `foods-aptamil` | `/foods?meal=lunch` | "Aptamil" (long names) |
| `foods-bhujia` | `/foods?meal=lunch` | "Haldiram's Aloo Bhujia Masala Namkeen" |
| `foods-new` | `/foods/new` | |
| `food-dal`, `food-aptamil` | `/foods/{id}` | |
| `scan` | `/scan` | fake camera live |
| `scan-label`, `scan-barcode`, `scan-meal` | `/scans/{id}` | done scans |
| `scan-failed` | `/scans/{id}` | failed, refunded scan |
| `progress`, `progress-month` | `/progress`, `/progress?range=month` | |
| `history` | `/history` | |
| `me`, `me-credits` | `/me`, `/me/credits` | |
| `onboarding` | `/onboarding?redo=1` | step 1, not submitted |
| `home`, `privacy`, `terms`, `about-data` | `/`, `/privacy`, `/terms`, `/about/data` | signed out |
| `sign-in` | `/sign-in` | signed out |

Food and scan ids are looked up from the demo data at the start of each run.

## What it checks

- **wrap**: every button, `role=button`/`tab`, `a[data-slot=button]`, `[data-chip]`/`[data-pill]` and
  pill-styled link: each text node renders on one line, and the control doesn't overflow
  (`scrollWidth <= clientWidth + 1`).
- **lime**: any visible text whose computed `color` is `--brand`.
- **contrast**: visible, non-`aria-hidden`, enabled text below WCAG AA (4.5:1; 3:1 at ≥ 24 px or
  ≥ 18.66 px bold) against the composited background under it (gradients are checked against each
  colour stop; text over images, video or canvas is counted as skipped).
- **target**: interactive elements under 44 × 44 px, unless a `::before`/`::after` hit area or a
  tight parent wrapper provides the target. Inline links inside prose are exempt.

With a sheet or dialog open, only the topmost one is audited (the page behind it is inert).
