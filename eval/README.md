# Scanning eval harness

`pnpm eval [--models=fast,strong]` runs the real extraction engine (`lib/engine/model.ts`
`extract()`, then `lib/engine/index.ts` `triage()` and `lib/engine/convert.ts` `toPer100()` — the
same calls the app makes) against a fixture suite, and reports:

- per-field accuracy (±5%) for `energyKcal`, `protein`, `carbs`, `fat`, `sugars`, `sodiumMg`
- schema-failure rate (the model call itself failed to produce a usable extraction)
- triage accuracy (did `triage()` classify the input as the fixture's expected `kind`)
- p50 / p95 latency
- mean cost per scan

It needs a real `GOOGLE_GENERATIVE_AI_API_KEY` (set it in `.env.local`, which is git-ignored —
see the root `README.md`'s Scanning section) and makes real network calls, so it is not run in
CI. With no key configured, or no fixtures, it prints `skipped: ...` and exits 0.

Each run writes `eval/results-<YYYY-MM-DD>.json` (git-ignored — see `.gitignore`'s
`eval/results-*.json` entry) with the full per-fixture, per-model results alongside the summary
table.

## Adding a fixture

Each fixture is a directory under `eval/fixtures/<id>/` holding 1–3 photos named `1.jpg` (plus
optionally `2.jpg`, `3.jpg`; `.jpeg`/`.png`/`.webp` also work), and a matching
`eval/expected/<id>.json`:

```json
{
  "kind": "label",
  "name": "Haldiram's Aloo Bhujia",
  "facts": { "energyKcal": 536, "protein": 8.4, "carbs": 48, "fat": 34, "sugars": 2.1, "sodiumMg": 780 },
  "basis": "per_100g"
}
```

- `kind` — one of `"barcode"`, `"label"`, `"front"`, `"meal"`: the engine's own triage
  classification for this input (see `Route` in `lib/engine/index.ts`), i.e. what
  `ScanResult.inputKind` should end up being.
- `name` — optional, informational only (not currently scored).
- `facts` — optional; per-100 g or per-100 ml values (whichever `basis` says), any subset of the
  six fields above. A field you don't include isn't scored for this fixture (see "Scoring
  decisions" in `eval/run.ts`'s comments for how 0 and missing values are handled). Omit `facts`
  entirely for a fixture with no printed nutrition panel (e.g. a front-of-pack or meal photo with
  nothing to grade numerically).
- `basis` — `"per_100g"` or `"per_100ml"`; informational (matches what `facts` is expressed in).

Aim for 25–30 fixtures covering a realistic spread: Indian packaged foods, Hindi-language labels,
blurry/glare photos, front-of-pack-only photos (no nutrition panel), and home-cooked meal photos.

## Running against one real label

`pnpm scan:try <image...>` (see the root README) runs a single real extraction without any of
the fixture/scoring machinery — useful for checking one photo while building up the fixture set.
