import { APICallError, NoObjectGeneratedError, NoOutputGeneratedError } from "ai";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { EngineError } from "./errors";
import { isRetryable, withRetry } from "./model";

// --- Fakes. No network: every error here is hand-built to match the shape the real SDK /
// fetch / zod would produce, per lib/engine/model.ts's classification rules. ---

function apiCallError(opts: { statusCode?: number; isRetryable?: boolean }): APICallError {
  return new APICallError({
    message: "boom",
    url: "https://generativelanguage.googleapis.com/v1beta/x",
    requestBodyValues: {},
    statusCode: opts.statusCode,
    isRetryable: opts.isRetryable,
  });
}

function zodError(): z.ZodError {
  const result = z.object({ a: z.string() }).safeParse({});
  if (result.success) throw new Error("expected zod parse to fail");
  return result.error;
}

describe("isRetryable", () => {
  it("is true for APICallError with a retryable status code (429, 500, 503)", () => {
    expect(isRetryable(apiCallError({ statusCode: 429 }))).toBe(true);
    expect(isRetryable(apiCallError({ statusCode: 500 }))).toBe(true);
    expect(isRetryable(apiCallError({ statusCode: 503 }))).toBe(true);
    expect(isRetryable(apiCallError({ statusCode: 502 }))).toBe(true);
    expect(isRetryable(apiCallError({ statusCode: 504 }))).toBe(true);
  });

  it("is false for APICallError with a non-retryable status code (400, 401, 403)", () => {
    expect(isRetryable(apiCallError({ statusCode: 400 }))).toBe(false);
    expect(isRetryable(apiCallError({ statusCode: 401 }))).toBe(false);
    expect(isRetryable(apiCallError({ statusCode: 403 }))).toBe(false);
  });

  it("defers to the SDK's own isRetryable flag regardless of status code", () => {
    expect(isRetryable(apiCallError({ statusCode: 404, isRetryable: true }))).toBe(true);
    expect(isRetryable(apiCallError({ statusCode: undefined, isRetryable: true }))).toBe(true);
  });

  it("is true for an AbortError (a per-call timeout firing)", () => {
    const err = Object.assign(new Error("aborted"), { name: "AbortError" });
    expect(isRetryable(err)).toBe(true);
  });

  it("is true for a TimeoutError", () => {
    const err = Object.assign(new Error("timed out"), { name: "TimeoutError" });
    expect(isRetryable(err)).toBe(true);
  });

  it("is true for network errors (TypeError, ECONNRESET)", () => {
    expect(isRetryable(new TypeError("fetch failed"))).toBe(true);
    expect(isRetryable(Object.assign(new Error("reset"), { code: "ECONNRESET" }))).toBe(true);
  });

  it("is false for a safety block / no-output-generated error", () => {
    expect(isRetryable(new NoOutputGeneratedError({ message: "no output" }))).toBe(false);
    expect(
      isRetryable(
        new NoObjectGeneratedError({
          message: "no object",
          response: { id: "x", timestamp: new Date(), modelId: "m" },
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, inputTokenDetails: {}, outputTokenDetails: {} } as never,
          finishReason: "content-filter",
        }),
      ),
    ).toBe(false);
  });

  it("is false for a zod validation error", () => {
    expect(isRetryable(zodError())).toBe(false);
  });

  it("is false for unknown error shapes", () => {
    expect(isRetryable("nope")).toBe(false);
    expect(isRetryable(null)).toBe(false);
    expect(isRetryable(undefined)).toBe(false);
    expect(isRetryable(new Error("generic failure"))).toBe(false);
  });
});

describe("withRetry", () => {
  it("retries once on a retryable error when at least 15s remain, then returns the success", async () => {
    let now = 0;
    const clock = () => now;
    let calls = 0;

    const result = await withRetry(
      async () => {
        calls++;
        if (calls === 1) {
          now += 1000; // the failed attempt consumes 1s
          throw apiCallError({ statusCode: 500 });
        }
        return "ok";
      },
      50_000,
      clock,
    );

    expect(result).toBe("ok");
    expect(calls).toBe(2);
  });

  it("does not retry when fewer than 15s remain after the failed attempt", async () => {
    let now = 0;
    const clock = () => now;
    let calls = 0;
    const err = apiCallError({ statusCode: 500 });

    await expect(
      withRetry(
        async () => {
          calls++;
          now = 40_000; // only 10s left of a 50s deadline after this attempt
          throw err;
        },
        50_000,
        clock,
      ),
    ).rejects.toBe(err);
    expect(calls).toBe(1);
  });

  it("never retries a non-retryable error, even with time to spare", async () => {
    let calls = 0;
    const err = apiCallError({ statusCode: 400 });

    await expect(
      withRetry(
        async () => {
          calls++;
          throw err;
        },
        50_000,
        () => 0,
      ),
    ).rejects.toBe(err);
    expect(calls).toBe(1);
  });

  it("retries at most once, even if the retry also fails retryably with time to spare", async () => {
    let calls = 0;
    const err = apiCallError({ statusCode: 500 });

    await expect(
      withRetry(
        async () => {
          calls++;
          throw err;
        },
        50_000,
        () => 0,
      ),
    ).rejects.toBe(err);
    expect(calls).toBe(2);
  });

  it("rejects with EngineError(TIMEOUT) without calling fn when under 1s of deadline remains", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          return "unreachable";
        },
        50_000,
        () => 49_500,
      ),
    ).rejects.toThrow(EngineError);
    expect(calls).toBe(0);

    try {
      await withRetry(async () => "unreachable", 50_000, () => 49_500);
      throw new Error("expected withRetry to reject");
    } catch (err) {
      expect(err).toBeInstanceOf(EngineError);
      expect((err as EngineError).code).toBe("TIMEOUT");
    }
  });

  it("surfaces the original error, not a synthetic TIMEOUT, when time runs out between attempts", async () => {
    // Even when almost no deadline remains after the failed attempt (not just under 15s, but
    // under the 1s per-call floor too), "don't retry" means propagate what actually happened —
    // EngineError("TIMEOUT") is reserved for the case where we never even got to try fn again.
    let now = 0;
    const clock = () => now;
    let calls = 0;
    const err = apiCallError({ statusCode: 500 });

    await expect(
      withRetry(
        async () => {
          calls++;
          now = 49_999; // < 1s left — the would-be retry must not happen
          throw err;
        },
        50_000,
        clock,
      ),
    ).rejects.toBe(err);
    expect(calls).toBe(1);
  });

  it("passes fn a real AbortSignal for the per-call timeout", async () => {
    await withRetry(
      async (signal) => {
        expect(signal).toBeInstanceOf(AbortSignal);
        expect(signal.aborted).toBe(false);
        return "ok";
      },
      50_000,
      () => 0,
    );
  });
});
