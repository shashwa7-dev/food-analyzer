import { describe, expect, it } from "vitest";
import { MODE_HINT, analysingStep, parseMode } from "./modes";

describe("scan modes", () => {
  it("parses with a label default", () => {
    expect(parseMode("barcode")).toBe("barcode");
    expect(parseMode("meal")).toBe("meal");
    expect(parseMode(null)).toBe("label");
    expect(parseMode("nope")).toBe("label");
  });
  it("has the spec hints", () => {
    expect(MODE_HINT).toEqual({
      barcode: "Point at a barcode",
      label: "Fit the nutrition table inside the frame",
      front: "Show the front of the pack",
      meal: "Get the whole plate in",
    });
  });
  it("advances steps on a 2 s timer but never claims the last step before done", () => {
    expect(analysingStep(0, false)).toBe(0);
    expect(analysingStep(2100, false)).toBe(1);
    expect(analysingStep(4100, false)).toBe(2);
    expect(analysingStep(60000, false)).toBe(2);
    expect(analysingStep(500, true)).toBe(3);
  });
});
