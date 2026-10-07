import { describe, expect, it } from "vitest";
import { normaliseBarcode } from "./barcode";

describe("normaliseBarcode", () => {
  it("accepts a valid EAN-13", () => {
    expect(normaliseBarcode("4006381333931")).toBe("4006381333931");
  });
  it("rejects an EAN-13 with a wrong check digit", () => {
    expect(normaliseBarcode("4006381333932")).toBeNull();
  });
  it("accepts a valid EAN-8", () => {
    expect(normaliseBarcode("96385074")).toBe("96385074");
  });
  it("upgrades a valid UPC-A (12 digits) to EAN-13 with a leading zero", () => {
    expect(normaliseBarcode("036000291452")).toBe("0036000291452");
  });
  it("strips spaces and dashes before validating", () => {
    expect(normaliseBarcode("4006-3813-33931")).toBe("4006381333931");
    expect(normaliseBarcode("4006 3813 33931")).toBe("4006381333931");
  });
  it("returns null for non-digit input", () => {
    expect(normaliseBarcode("abc")).toBeNull();
  });
  it("returns null for the wrong length", () => {
    expect(normaliseBarcode("12345")).toBeNull();
    expect(normaliseBarcode("123456789012345")).toBeNull();
  });
});
