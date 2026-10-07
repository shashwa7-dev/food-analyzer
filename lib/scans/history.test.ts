import { describe, expect, it } from "vitest";
import { confidenceLabel, inputKindLabel, isScanFailed, isScanRunning, recentScanMeta, scanTitle } from "./history";

describe("inputKindLabel", () => {
  it("labels every scanInputKindEnum value", () => {
    expect(inputKindLabel("barcode")).toBe("Barcode");
    expect(inputKindLabel("label")).toBe("Label");
    expect(inputKindLabel("front")).toBe("Front of pack");
    expect(inputKindLabel("meal")).toBe("Meal photo");
  });
  it("is null for null or an unknown kind", () => {
    expect(inputKindLabel(null)).toBeNull();
    expect(inputKindLabel("whatever")).toBeNull();
  });
});

describe("confidenceLabel", () => {
  it("labels every confidence value", () => {
    expect(confidenceLabel("high")).toBe("High");
    expect(confidenceLabel("medium")).toBe("Medium");
    expect(confidenceLabel("low")).toBe("Low");
  });
  it("is null for null or an unknown value", () => {
    expect(confidenceLabel(null)).toBeNull();
    expect(confidenceLabel("whatever")).toBeNull();
  });
});

describe("scanTitle", () => {
  const s = (status: string, errorCode: string | null = null, name: string | null = "Thali") => ({ status, errorCode, name });
  it("names a running, failed, not-found and finished scan", () => {
    expect(scanTitle(s("queued"))).toBe("Analysing…");
    expect(scanTitle(s("processing"))).toBe("Analysing…");
    expect(scanTitle(s("failed", "AI_TIMEOUT"))).toBe("Scan failed");
    expect(scanTitle(s("done", "BARCODE_NOT_FOUND", null))).toBe("Barcode not found");
    expect(scanTitle(s("done"))).toBe("Thali");
    expect(scanTitle(s("done", null, null))).toBe("Scan");
    expect(isScanRunning(s("done"))).toBe(false);
    expect(isScanFailed(s("done", "BARCODE_NOT_FOUND"))).toBe(true);
  });
});

describe("recentScanMeta", () => {
  it("marks an uncharged barcode as free and labels the rest by kind", () => {
    expect(recentScanMeta({ inputKind: "barcode", charged: false })).toBe("Barcode · free");
    expect(recentScanMeta({ inputKind: "barcode", charged: true })).toBe("Barcode");
    expect(recentScanMeta({ inputKind: "label", charged: true })).toBe("Label");
    expect(recentScanMeta({ inputKind: "meal", charged: true })).toBe("Meal photo");
    expect(recentScanMeta({ inputKind: null, charged: false })).toBeNull();
  });
});
