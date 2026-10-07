import { google } from "@ai-sdk/google";
import { APICallError, generateText, NoObjectGeneratedError, NoOutputGeneratedError, Output } from "ai";
import { z } from "zod";
import { EngineError } from "./errors";
import { DEFAULT_MODEL_FAST, DEFAULT_MODEL_STRONG } from "./models";
import { EXTRACTION_PROMPT } from "./prompt";
import { type EngineImage, type Extraction, ModelExtractionSchema, sanitiseExtraction } from "./schema";

// --- Config -----------------------------------------------------------------------------
//
// lib/env.ts's env() requires auth vars (BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, ...) to be set,
// so scripts/scan-try.ts (and any test) that only has GOOGLE_GENERATIVE_AI_API_KEY would throw
// before reaching this file. model.ts is the one file in lib/engine allowed network access
// (constraints.md), so — same exception already granted to lib/db/client.ts for DATABASE_URL —
// it reads its three env vars directly from process.env instead of going through env().
// @ai-sdk/google's `google` provider already defaults to GOOGLE_GENERATIVE_AI_API_KEY itself;
// we only read it here to fail fast with EngineError("MODEL_ERROR") before making a network call.
function readModelConfig() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const fast = process.env.MODEL_FAST?.trim() || DEFAULT_MODEL_FAST;
  const strong = process.env.MODEL_STRONG?.trim() || DEFAULT_MODEL_STRONG;
  return { apiKey: apiKey && apiKey.length > 0 ? apiKey : undefined, fast, strong };
}

// Fixed, user-safe error messages (spec: API errors are user-safe sentences). The original
// error (network failure, provider error, zod error, ...) is preserved as `cause` for logs.
const MESSAGES = {
  notConfigured: "Scanning isn't set up yet.",
  noImages: "Couldn't read the photo. Please try again with 1 to 3 photos.",
  timeout: "The scan took too long and timed out. Please try again.",
  modelError: "The scan couldn't be completed. Please try again.",
} as const;

// --- Pricing ------------------------------------------------------------------------------
//
// Source: https://ai.google.dev/gemini-api/docs/pricing (standard/paid tier, text & image input),
// read 2026-10-07. Both MODEL_FAST and MODEL_STRONG defaults are listed by name on that page, so
// no closest-tier substitution was needed.
//   gemini-3.5-flash:      $1.50 / 1M input tokens, $9.00 / 1M output tokens
//   gemini-3.5-flash-lite: $0.30 / 1M input tokens, $2.50 / 1M output tokens
// $X per 1M tokens == X micro-USD per token (1 micro-USD = 1e-6 USD), so the per-1M-token dollar
// figures above are used directly as the per-token micro-USD rates below.
export const PRICES: Record<string, { inMicrosPerToken: number; outMicrosPerToken: number }> = {
  "gemini-3.5-flash": { inMicrosPerToken: 1.5, outMicrosPerToken: 9.0 },
  "gemini-3.5-flash-lite": { inMicrosPerToken: 0.3, outMicrosPerToken: 2.5 },
};

// --- Error classification ------------------------------------------------------------------
//
// Only 429/5xx/network/timeout errors are retryable, and only ever once (withRetry below) —
// see constraints.md's engine time budget and the task-5 plan-review amendments.
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

// Node's fetch throws a bare TypeError for network-level failures — but TypeError is also what
// a plain programming bug throws, so match its message rather than treating every TypeError as
// a transient network error.
const NETWORK_TYPE_ERROR = /fetch failed|failed to fetch/i;

function hasStringProp<K extends string>(err: unknown, key: K): err is Record<K, string> {
  return typeof err === "object" && err !== null && key in err && typeof (err as Record<string, unknown>)[key] === "string";
}

export function isRetryable(err: unknown): boolean {
  if (APICallError.isInstance(err)) {
    return err.isRetryable || (err.statusCode !== undefined && RETRYABLE_STATUS_CODES.has(err.statusCode));
  }
  // Safety blocks and "model produced nothing usable" are not transient — retrying won't help.
  if (NoOutputGeneratedError.isInstance(err) || NoObjectGeneratedError.isInstance(err)) return false;
  if (err instanceof z.ZodError) return false;
  if (err instanceof TypeError && NETWORK_TYPE_ERROR.test(err.message)) return true;
  if (hasStringProp(err, "code") && err.code === "ECONNRESET") return true;
  // AbortSignal.timeout() (our per-call timeout) and the SDK's own timeout both surface as one
  // of these two DOMException names.
  if (hasStringProp(err, "name") && (err.name === "AbortError" || err.name === "TimeoutError")) return true;
  return false;
}

// --- Retry with a deadline ------------------------------------------------------------------
//
// At most one retry, and only when there's enough of the overall deadline left to be worth it.
// `fn` receives a fresh per-call AbortSignal each attempt — the per-call timeout floor from the
// task-5 amendments: max(1s, min(25s, time left)), and if under 1s is left, fail with
// EngineError("TIMEOUT") before even trying (never call the model with a sub-1s budget).
const MIN_CALL_TIMEOUT_MS = 1000;
const MAX_CALL_TIMEOUT_MS = 25_000;
const MIN_RETRY_REMAINING_MS = 15_000;

export async function withRetry<T>(fn: (signal: AbortSignal) => Promise<T>, deadline: number, now: () => number = Date.now): Promise<T> {
  let attempted = false;
  for (;;) {
    const remaining = deadline - now();
    if (remaining < MIN_CALL_TIMEOUT_MS) throw new EngineError("TIMEOUT", MESSAGES.timeout);

    const perCallMs = Math.max(MIN_CALL_TIMEOUT_MS, Math.min(MAX_CALL_TIMEOUT_MS, remaining));
    try {
      return await fn(AbortSignal.timeout(perCallMs));
    } catch (err) {
      if (attempted || !isRetryable(err) || deadline - now() < MIN_RETRY_REMAINING_MS) throw err;
      attempted = true;
    }
  }
}

// --- Mapping a failure to the engine's error vocabulary --------------------------------------
//
// Used both when the call (incl. its one retry) fails outright, and when a successful-looking
// result's `.output` getter throws (a safety block etc. — see finalizeResult below). A per-call
// timeout firing mid-request, the outer signal being aborted, or the overall deadline having
// passed by the time we're back from the SDK all mean the same thing to the caller: TIMEOUT, not
// a generic model error. An EngineError that already made it this far (e.g. withRetry's own
// pre-call floor check, or callOnce's own abort check below) is never second-guessed.
export function toEngineError(err: unknown, ctx: { signal: AbortSignal; deadline: number; now?: () => number }): EngineError {
  if (err instanceof EngineError) return err;
  const now = ctx.now ?? Date.now;
  const name = hasStringProp(err, "name") ? err.name : undefined;
  const isTimeout = ctx.signal.aborted || now() >= ctx.deadline || name === "TimeoutError" || name === "AbortError";
  return new EngineError(isTimeout ? "TIMEOUT" : "MODEL_ERROR", isTimeout ? MESSAGES.timeout : MESSAGES.modelError, { cause: err });
}

// A minimal structural shape of GenerateTextResult that finalizeResult needs — declared locally
// (rather than imported) so this stays easy to satisfy with a fake in tests.
type ResultLike = { output: unknown; usage: { inputTokens?: number; outputTokens?: number } };

// Reads `result.output` (a getter that throws NoOutputGeneratedError for a safety-blocked or
// otherwise empty response — see the "ai" package's doc comment on GenerateTextResult.output)
// and `result.usage` inside a guarded section, so that failure is mapped through toEngineError
// exactly like a network/provider failure, instead of escaping as a raw SDK error.
export function finalizeResult(
  result: ResultLike,
  ctx: { signal: AbortSignal; deadline: number; now?: () => number },
): { data: Extraction; usage: { inputTokens: number; outputTokens: number } } {
  try {
    const data = sanitiseExtraction(result.output);
    const usage = { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0 };
    return { data, usage };
  } catch (err) {
    throw toEngineError(err, ctx);
  }
}

// --- Extraction ------------------------------------------------------------------------------

export async function extract(
  images: EngineImage[],
  opts: { model: "fast" | "strong"; signal: AbortSignal; deadline: number },
): Promise<{ data: Extraction; usage: { inputTokens: number; outputTokens: number }; modelId: string; costMicros: number }> {
  if (images.length === 0 || images.length > 3) throw new EngineError("UNREADABLE_IMAGE", MESSAGES.noImages);

  const config = readModelConfig();
  if (!config.apiKey) throw new EngineError("MODEL_ERROR", MESSAGES.notConfigured);

  const modelId = opts.model === "fast" ? config.fast : config.strong;
  const ctx = { signal: opts.signal, deadline: opts.deadline };

  const callOnce = async (perCallSignal: AbortSignal) => {
    // The outer (caller-supplied) signal is allowed to end the whole operation at any time
    // (route cancellation, overall request abort, ...). Checking it here — and failing with a
    // non-retryable EngineError rather than letting generateText throw its own AbortError —
    // is what makes withRetry's single retry never fire again once the outer signal is gone,
    // without withRetry itself needing to know anything about signals.
    if (opts.signal.aborted) throw new EngineError("TIMEOUT", MESSAGES.timeout);
    return generateText({
      model: google(modelId),
      output: Output.object({ schema: ModelExtractionSchema }),
      system: EXTRACTION_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            ...images.map((img) => ({ type: "file" as const, mediaType: img.mime, data: img.data })),
            { type: "text" as const, text: "Extract per the schema." },
          ],
        },
      ],
      abortSignal: AbortSignal.any([opts.signal, perCallSignal]),
      maxRetries: 0,
      // Minimal reasoning for the fast tier, low for the strong tier — this is a transcription
      // task (copy what's printed), not a reasoning task, so spending thinking tokens on it
      // only adds latency and cost. @ai-sdk/google maps "none" to each Gemini model's own
      // minimum thinking level and "low" to its "low" thinkingLevel/thinkingBudget.
      reasoning: opts.model === "fast" ? "none" : "low",
    });
  };

  let result: Awaited<ReturnType<typeof callOnce>>;
  try {
    result = await withRetry(callOnce, opts.deadline);
  } catch (err) {
    throw toEngineError(err, ctx);
  }

  const { data, usage } = finalizeResult(result, ctx);
  const price = PRICES[modelId];
  const costMicros = price ? Math.round(usage.inputTokens * price.inMicrosPerToken + usage.outputTokens * price.outMicrosPerToken) : 0;

  return { data, usage, modelId, costMicros };
}
