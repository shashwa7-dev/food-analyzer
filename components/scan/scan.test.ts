import { describe, expect, it } from "vitest";
import { encodeWithinBudget, fitWithin, PHOTO_TOO_LARGE_MESSAGE, UNSUPPORTED_PHOTO_MESSAGE } from "./compress";
import { pickBarcode } from "./barcode-reader";
import { analysingStep } from "@/lib/scans/modes";
import { isSlow, SCAN_STEPS, SLOW_AFTER_MS, stepState } from "./progress-steps";

const blobOf = (bytes: number) => new Blob([new Uint8Array(bytes)], { type: "image/jpeg" });

describe("fitWithin", () => {
  it("caps the long edge at 1600 px, keeping the aspect ratio", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(1920, 1080)).toEqual({ width: 1600, height: 900 });
  });
  it("never scales up and rounds to whole pixels", () => {
    expect(fitWithin(1280, 720)).toEqual({ width: 1280, height: 720 });
    expect(fitWithin(3000, 1001)).toEqual({ width: 1600, height: 534 });
    expect(fitWithin(100000, 10)).toEqual({ width: 1600, height: 1 });
  });
  it("rejects empty dimensions", () => {
    expect(() => fitWithin(0, 100)).toThrow(UNSUPPORTED_PHOTO_MESSAGE);
  });
});

describe("encodeWithinBudget", () => {
  it("keeps the 0.8 encode when it fits", async () => {
    const tried: number[] = [];
    const b = await encodeWithinBudget(async (q) => (tried.push(q), blobOf(500_000)));
    expect(tried).toEqual([0.8]);
    expect(b.size).toBe(500_000);
  });
  it("retries at 0.65 when 0.8 is over 1.2 MB", async () => {
    const tried: number[] = [];
    const b = await encodeWithinBudget(async (q) => (tried.push(q), blobOf(q === 0.8 ? 1_300_000 : 900_000)));
    expect(tried).toEqual([0.8, 0.65]);
    expect(b.size).toBe(900_000);
  });
  it("fails clearly when even 0.65 is too large, or the canvas can't encode", async () => {
    await expect(encodeWithinBudget(async () => blobOf(1_200_001))).rejects.toThrow(PHOTO_TOO_LARGE_MESSAGE);
    await expect(encodeWithinBudget(async () => null)).rejects.toThrow(UNSUPPORTED_PHOTO_MESSAGE);
  });
});

describe("pickBarcode", () => {
  it("returns the first valid code, normalising UPC-A to EAN-13", () => {
    expect(pickBarcode(["hello", "8901063010277"])).toBe("8901063010277");
    expect(pickBarcode(["036000291452"])).toBe("0036000291452");
    expect(pickBarcode(["96385074"])).toBe("96385074");
  });
  it("ignores bad check digits and empty input", () => {
    expect(pickBarcode(["8901063010278"])).toBeNull();
    expect(pickBarcode([])).toBeNull();
  });
});

describe("analysing steps", () => {
  const states = (elapsed: number, done: boolean) => SCAN_STEPS.map((_, i) => stepState(i, analysingStep(elapsed, done)));
  it("advances every 2 s and holds on grading while the scan runs", () => {
    expect(states(0, false)).toEqual(["active", "wait", "wait", "wait"]);
    expect(states(2_000, false)).toEqual(["done", "active", "wait", "wait"]);
    expect(states(4_000, false)).toEqual(["done", "done", "active", "wait"]);
    expect(states(120_000, false)).toEqual(["done", "done", "active", "wait"]);
  });
  it("only reaches the last step once the scan is done, however early", () => {
    expect(states(200, true)).toEqual(["done", "done", "done", "active"]);
  });
});

describe("isSlow", () => {
  const created = "2026-10-07T10:00:00.000Z";
  const at = Date.parse(created);
  it("times the 65 s from the scan's createdAt, not from when the screen opened", () => {
    expect(isSlow(created, at + 60_000, at + SLOW_AFTER_MS + 1)).toBe(true);
    expect(isSlow(created, at, at + SLOW_AFTER_MS - 1)).toBe(false);
  });
  it("falls back to the screen's start before the first poll (or on a bad date)", () => {
    expect(isSlow(undefined, at, at + SLOW_AFTER_MS + 1)).toBe(true);
    expect(isSlow("nope", at, at + 1_000)).toBe(false);
  });
});
