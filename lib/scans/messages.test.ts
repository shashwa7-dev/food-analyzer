import { describe, expect, it } from "vitest";
import { REFUNDED_MESSAGE, SCAN_ERROR_CODES, SCAN_MESSAGES, scanErrorMessage } from "./messages";

describe("scan messages", () => {
  it("has one non-empty sentence per error code", () => {
    for (const c of SCAN_ERROR_CODES) expect(SCAN_MESSAGES[c]).toMatch(/\.$/);
    expect(Object.keys(SCAN_MESSAGES).sort()).toEqual([...SCAN_ERROR_CODES].sort());
  });
  it("prefers the engine's specific sentence and appends the refund note after a charge", () => {
    expect(scanErrorMessage("NOT_FOOD")).toBe(SCAN_MESSAGES.NOT_FOOD);
    expect(scanErrorMessage("TIMEOUT", { refunded: true })).toBe(`${SCAN_MESSAGES.TIMEOUT} ${REFUNDED_MESSAGE}`);
    expect(scanErrorMessage("UNREADABLE_IMAGE", { specific: "We don't know this product yet." })).toBe("We don't know this product yet.");
  });
  it("falls back to MODEL_ERROR's sentence for an unknown code", () => {
    expect(scanErrorMessage("WHATEVER")).toBe(SCAN_MESSAGES.MODEL_ERROR);
  });
});
