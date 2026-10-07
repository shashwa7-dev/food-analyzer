import { describe, expect, it } from "vitest";
import { confidenceLabel, inputKindLabel } from "./history";

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
