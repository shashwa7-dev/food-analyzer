import { describe, expect, it } from "vitest";
import { portionLine, sourceLine } from "./display";

describe("portionLine", () => {
  it("adds the weight to a household portion", () => {
    expect(portionLine({ label: "1 katori", grams: 150 })).toBe("1 katori · 150 g");
    expect(portionLine({ label: "1 glass", grams: 200 }, "ml")).toBe("1 glass · 200 ml");
  });
  it("doesn't repeat a weight label or invent one", () => {
    expect(portionLine({ label: "100 g", grams: 100 })).toBe("100 g");
    expect(portionLine({ label: "1 serving", grams: null })).toBe("1 serving");
  });
});

describe("sourceLine", () => {
  it("names home-style INDB dishes and branded packs", () => {
    expect(sourceLine({ source: "indb", kind: "dish", brand: null })).toBe("Home-style · INDB");
    expect(sourceLine({ source: "off", kind: "packaged", brand: "Haldiram's" })).toBe("Haldiram's · Open Food Facts");
    expect(sourceLine({ source: "fndds", kind: "generic", brand: null })).toBe("Generic · USDA");
  });
  it("calls custom foods my food", () => {
    expect(sourceLine({ source: "custom", kind: "dish", brand: null })).toBe("My food");
  });
});
