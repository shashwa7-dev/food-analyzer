// Scanning-engine eval harness (M2 task 12) — `pnpm eval [--models=fast,strong]`.
//
// For each fixture under eval/fixtures/<id>/ with a matching eval/expected/<id>.json, calls the
// real lib/engine/model.ts `extract()` (same call scripts/scan-try.ts makes) for each requested
// model tier, then the engine's own `triage()` (lib/engine/index.ts) and `toPer100()`
// (lib/engine/convert.ts) — the same conversion runAi uses — and scores the result against the
// fixture's expected values. Never touches the DB or Open Food Facts: those are inputs to the
// full runAi pipeline that a fixture-based eval doesn't have (no seeded catalogue, no network
// OFF calls), so this only evaluates what `extract` + `triage` + `toPer100` get right on their
// own — the model's reading of the label/photo, not the DB-assisted merge.
//
// Not run in CI: needs a real GOOGLE_GENERATIVE_AI_API_KEY and makes real network calls, and
// needs fixtures that aren't committed (see eval/README.md). With either missing, this exits 0
// with a "skipped: ..." message — never fails a build.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { toPer100 } from "@/lib/engine/convert";
import { EngineError } from "@/lib/engine/errors";
import { triage, type Route } from "@/lib/engine";
import { loadImages } from "@/lib/engine/load-images";
import { extract } from "@/lib/engine/model";
import type { Extraction } from "@/lib/engine/schema";

const FIXTURES_DIR = join(process.cwd(), "eval", "fixtures");
const EXPECTED_DIR = join(process.cwd(), "eval", "expected");
const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp"];
const VALID_KINDS: readonly Route[] = ["barcode", "label", "front", "meal"];

export const FIELD_KEYS = ["energyKcal", "protein", "carbs", "fat", "sugars", "sodiumMg"] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];
export type ModelTier = "fast" | "strong";

export interface ExpectedFixture {
  kind: Route;
  name?: string;
  facts?: Partial<Record<FieldKey, number>>;
  basis?: "per_100g" | "per_100ml";
}

export interface FixtureCase {
  id: string;
  imagePaths: string[];
  expected: ExpectedFixture;
}

/**
 * One fixture × one model tier. `route` is the engine's own triage() classification, or the
 * image-level outcome when triage() itself threw (a correct real-world outcome, not a schema
 * failure — e.g. the fixture really is unreadable). `schemaFailure` is set only when `extract()`
 * itself threw (the model's structured output never came back usable) — see schemaFailureRate.
 */
export interface AttemptResult {
  fixtureId: string;
  model: ModelTier;
  modelId: string | null;
  latencyMs: number;
  costMicros: number;
  schemaFailure: boolean;
  route: Route | "not_food" | "unreadable" | null;
  per100: Partial<Record<FieldKey, number>>;
  expected: ExpectedFixture;
}

// --- Fixture discovery -----------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function parseExpected(raw: unknown, id: string): ExpectedFixture {
  if (!isRecord(raw) || typeof raw.kind !== "string" || !VALID_KINDS.includes(raw.kind as Route)) {
    throw new Error(`eval/expected/${id}.json: "kind" must be one of ${VALID_KINDS.join(", ")}`);
  }
  const factsRaw = raw.facts;
  const facts = isRecord(factsRaw)
    ? Object.fromEntries(FIELD_KEYS.filter((k) => typeof factsRaw[k] === "number").map((k) => [k, factsRaw[k] as number]))
    : undefined;
  return {
    kind: raw.kind as Route,
    name: typeof raw.name === "string" ? raw.name : undefined,
    facts: facts && Object.keys(facts).length > 0 ? (facts as ExpectedFixture["facts"]) : undefined,
    basis: raw.basis === "per_100g" || raw.basis === "per_100ml" ? raw.basis : undefined,
  };
}

/** Fixtures with a matching eval/expected/<id>.json and at least one 1.jpg/2.jpg/3.jpg image. */
export function discoverFixtures(fixturesDir = FIXTURES_DIR, expectedDir = EXPECTED_DIR): FixtureCase[] {
  if (!existsSync(fixturesDir)) return [];
  const ids = readdirSync(fixturesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const cases: FixtureCase[] = [];
  for (const id of ids) {
    const expectedPath = join(expectedDir, `${id}.json`);
    if (!existsSync(expectedPath)) {
      console.warn(`skipping fixture "${id}": no eval/expected/${id}.json`);
      continue;
    }
    const dir = join(fixturesDir, id);
    const imagePaths = ["1", "2", "3"]
      .flatMap((n) => IMAGE_EXTS.map((ext) => join(dir, `${n}${ext}`)))
      .filter((p) => existsSync(p));
    if (imagePaths.length === 0) {
      console.warn(`skipping fixture "${id}": no images found (expected eval/fixtures/${id}/1.jpg, optionally 2.jpg/3.jpg)`);
      continue;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(expectedPath, "utf8"));
    } catch (err) {
      console.warn(`skipping fixture "${id}": eval/expected/${id}.json is not valid JSON (${(err as Error).message})`);
      continue;
    }
    cases.push({ id, imagePaths, expected: parseExpected(raw, id) });
  }
  return cases;
}

// --- Scoring (pure) ---------------------------------------------------------------------------
//
// A field is graded ±5% relative to the expected value. Two cases that ±5% can't express are
// decided explicitly:
//   - expected is 0: relative tolerance divides by zero, so a 0 is instead treated as
//     "basically zero" — the actual value must be within ZERO_TOLERANCE_ABS of it. That
//     threshold is well under a label's own printed rounding (whole units, or 0.1 for small
//     macros), so it doesn't accidentally pass a real miss.
//   - expected is present but the model didn't extract that field (actual undefined): scored as
//     a miss, not skipped — the fixture asked for a value and didn't get one.
//   - expected itself is missing (the fixture doesn't claim a value for that field): skipped —
//     excluded from both the numerator and denominator, so fixtures that only have some fields
//     (e.g. a front-of-pack fixture with no sugars) don't drag down fields they say nothing about.
const FIELD_TOLERANCE_PCT = 0.05;
const ZERO_TOLERANCE_ABS = 0.05;

export type FieldScore = "match" | "miss" | "skip";

export function scoreField(actual: number | undefined, expected: number | undefined): FieldScore {
  if (expected === undefined) return "skip";
  if (actual === undefined) return "miss";
  if (expected === 0) return Math.abs(actual) <= ZERO_TOLERANCE_ABS ? "match" : "miss";
  return Math.abs(actual - expected) / Math.abs(expected) <= FIELD_TOLERANCE_PCT ? "match" : "miss";
}

/** Accuracy for one field across attempts, excluding "skip"s from the denominator. `null` when nothing was gradable. */
export function fieldAccuracy(attempts: AttemptResult[], field: FieldKey): number | null {
  let matches = 0;
  let graded = 0;
  for (const a of attempts) {
    const score = scoreField(a.per100[field], a.expected.facts?.[field]);
    if (score === "skip") continue;
    graded++;
    if (score === "match") matches++;
  }
  return graded === 0 ? null : matches / graded;
}

/** Fraction of attempts where extract() itself failed to produce a usable extraction. */
export function schemaFailureRate(attempts: AttemptResult[]): number {
  if (attempts.length === 0) return 0;
  return attempts.filter((a) => a.schemaFailure).length / attempts.length;
}

/** Fraction of non-schema-failure attempts whose triage route matched the fixture's expected `kind`. */
export function triageAccuracy(attempts: AttemptResult[]): number | null {
  const gradable = attempts.filter((a) => !a.schemaFailure);
  if (gradable.length === 0) return null;
  const correct = gradable.filter((a) => a.route === a.expected.kind).length;
  return correct / gradable.length;
}

/** Linear-interpolation percentile (same convention as numpy's default). `values` need not be sorted. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo]!;
  const frac = rank - lo;
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac;
}

export function meanCostMicros(attempts: AttemptResult[]): number {
  if (attempts.length === 0) return 0;
  return attempts.reduce((s, a) => s + a.costMicros, 0) / attempts.length;
}

export interface ModelSummary {
  model: ModelTier;
  modelId: string;
  fixtures: number;
  schemaFailurePct: number;
  triageAccuracyPct: number | null;
  fieldAccuracyPct: Partial<Record<FieldKey, number | null>>;
  p50LatencyMs: number;
  p95LatencyMs: number;
  meanCostMicros: number;
}

export function summarize(model: ModelTier, attempts: AttemptResult[]): ModelSummary {
  const fieldAccuracyPct: Partial<Record<FieldKey, number | null>> = {};
  for (const f of FIELD_KEYS) {
    const acc = fieldAccuracy(attempts, f);
    fieldAccuracyPct[f] = acc === null ? null : acc * 100;
  }
  const triageAcc = triageAccuracy(attempts);
  return {
    model,
    modelId: attempts.find((a) => a.modelId)?.modelId ?? `(${model})`,
    fixtures: attempts.length,
    schemaFailurePct: schemaFailureRate(attempts) * 100,
    triageAccuracyPct: triageAcc === null ? null : triageAcc * 100,
    fieldAccuracyPct,
    p50LatencyMs: percentile(attempts.map((a) => a.latencyMs), 50),
    p95LatencyMs: percentile(attempts.map((a) => a.latencyMs), 95),
    meanCostMicros: meanCostMicros(attempts),
  };
}

// --- Table formatting --------------------------------------------------------------------------

export function formatTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)));
  const line = (cells: string[]) => cells.map((c, i) => (c ?? "").padEnd(widths[i]!)).join("  ");
  const sep = widths.map((w) => "-".repeat(w)).join("  ");
  return [line(headers), sep, ...rows.map(line)].join("\n");
}

const pct = (v: number | null | undefined): string => (v === null || v === undefined ? "—" : `${v.toFixed(0)}%`);

export function renderSummaryTable(summaries: ModelSummary[]): string {
  const headers = ["model", "modelId", "n", "schema fail", "triage", ...FIELD_KEYS, "p50 ms", "p95 ms", "mean cost"];
  const rows = summaries.map((s) => [
    s.model,
    s.modelId,
    String(s.fixtures),
    pct(s.schemaFailurePct),
    pct(s.triageAccuracyPct),
    ...FIELD_KEYS.map((f) => pct(s.fieldAccuracyPct[f])),
    s.p50LatencyMs.toFixed(0),
    s.p95LatencyMs.toFixed(0),
    `$${(s.meanCostMicros / 1_000_000).toFixed(6)}`,
  ]);
  return formatTable(headers, rows);
}

// --- Running fixtures through the real engine --------------------------------------------------

function parseModels(argv: string[]): ModelTier[] {
  const flag = argv.find((a) => a === "--models" || a.startsWith("--models="));
  if (!flag) return ["fast", "strong"];
  const value = flag.includes("=") ? flag.slice(flag.indexOf("=") + 1) : argv[argv.indexOf(flag) + 1];
  const tiers = (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((t): t is ModelTier => t === "fast" || t === "strong");
  return tiers.length > 0 ? tiers : ["fast", "strong"];
}

/** triage()'s own "this image set isn't usable" outcomes are real classification results, not schema failures. */
function routeOrImageOutcome(x: Extraction): AttemptResult["route"] {
  try {
    return triage(x);
  } catch (err) {
    if (err instanceof EngineError && err.code === "NOT_FOOD") return "not_food";
    if (err instanceof EngineError && err.code === "UNREADABLE_IMAGE") return "unreadable";
    throw err;
  }
}

async function runAttempt(fixture: FixtureCase, model: ModelTier): Promise<AttemptResult> {
  const images = loadImages(fixture.imagePaths);
  const deadline = Date.now() + 50_000;
  const start = performance.now();

  let data: Extraction;
  let modelId: string | null = null;
  let costMicros = 0;
  try {
    const out = await extract(images, { model, signal: new AbortController().signal, deadline });
    data = out.data;
    modelId = out.modelId;
    costMicros = out.costMicros;
  } catch {
    return {
      fixtureId: fixture.id, model, modelId: null, latencyMs: performance.now() - start, costMicros: 0,
      schemaFailure: true, route: null, per100: {}, expected: fixture.expected,
    };
  }
  const latencyMs = performance.now() - start;

  const route = routeOrImageOutcome(data);
  const converted = data.facts ? toPer100(data.facts) : null;
  const per100: Partial<Record<FieldKey, number>> = {};
  if (converted) for (const f of FIELD_KEYS) { const v = converted.per100[f]; if (typeof v === "number") per100[f] = v; }

  return { fixtureId: fixture.id, model, modelId, latencyMs, costMicros, schemaFailure: false, route, per100, expected: fixture.expected };
}

async function main() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    console.log("skipped: GOOGLE_GENERATIVE_AI_API_KEY is not set. See README.md's Scanning section, then rerun `pnpm eval`.");
    return;
  }

  const fixtures = discoverFixtures();
  if (fixtures.length === 0) {
    console.log("skipped: no fixtures found under eval/fixtures/. See eval/README.md to add some.");
    return;
  }

  const models = parseModels(process.argv.slice(2));
  console.log(`Running eval over ${fixtures.length} fixture(s) x ${models.length} model(s): ${models.join(", ")}\n`);

  const attempts: AttemptResult[] = [];
  for (const model of models) {
    for (const fixture of fixtures) {
      process.stdout.write(`  [${model}] ${fixture.id} ... `);
      let attempt: AttemptResult;
      try {
        attempt = await runAttempt(fixture, model);
      } catch (err) {
        console.log(`skipped (${(err as Error).message})`); // e.g. an image became unreadable; keep the run going
        continue;
      }
      attempts.push(attempt);
      console.log(attempt.schemaFailure ? "schema failure" : `route=${attempt.route} (${attempt.latencyMs.toFixed(0)} ms)`);
    }
  }

  const summaries = models.map((model) => summarize(model, attempts.filter((a) => a.model === model)));
  console.log(`\n${renderSummaryTable(summaries)}`);

  const date = new Date().toISOString().slice(0, 10);
  const outPath = join(process.cwd(), "eval", `results-${date}.json`);
  writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), summaries, attempts }, null, 2));
  console.log(`\nWrote ${outPath}`);
}

if (process.argv[1]?.endsWith("run.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
