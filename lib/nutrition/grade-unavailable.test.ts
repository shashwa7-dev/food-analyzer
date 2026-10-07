import { describe, expect, it } from "vitest";
import { figureSourceOf, GRADE_UNAVAILABLE, gradedDropped, gradeUnavailableReason } from "./grade-unavailable";

describe("grade unavailable", () => {
  it("is '?', the value grade strings take", () => {
    expect(GRADE_UNAVAILABLE).toBe("?");
  });

  it("names a dropped nutrient the grade scores", () => {
    expect(gradeUnavailableReason(["sodiumMg"], "label")).toBe("Sodium on this label isn't plausible, so we can't grade it.");
    expect(gradeUnavailableReason(["sugars"], "estimate")).toBe("Sugar in this estimate isn't plausible, so we can't grade it.");
    expect(gradeUnavailableReason(["satFat"], "data")).toBe("Saturated fat in this food's data isn't plausible, so we can't grade it.");
    expect(gradeUnavailableReason(["energyKcal"], "label")).toBe("Energy on this label isn't plausible, so we can't grade it.");
  });

  it("lists several, plural", () => {
    expect(gradeUnavailableReason(["sugars", "satFat", "sodiumMg"], "label")).toBe("Sugar, saturated fat and sodium on this label aren't plausible, so we can't grade it.");
    expect(gradeUnavailableReason(["sodiumMg", "sugars"], "label")).toBe("Sodium and sugar on this label aren't plausible, so we can't grade it.");
  });

  it("is null when nothing graded was dropped: fibre, added sugars and trans fat only make the grade more cautious", () => {
    expect(gradeUnavailableReason(undefined, "label")).toBeNull();
    expect(gradeUnavailableReason([], "label")).toBeNull();
    expect(gradeUnavailableReason(["fibre", "addedSugars", "transFat"], "label")).toBeNull();
    expect(gradedDropped(["fibre", "sodiumMg", "transFat"])).toEqual(["sodiumMg"]);
  });

  it("calls Open Food Facts, community and custom figures a label; reference tables data", () => {
    expect(figureSourceOf("off")).toBe("label");
    expect(figureSourceOf("crowd")).toBe("label");
    expect(figureSourceOf("custom")).toBe("label");
    expect(figureSourceOf("indb")).toBe("data");
    expect(figureSourceOf("fndds")).toBe("data");
  });
});
