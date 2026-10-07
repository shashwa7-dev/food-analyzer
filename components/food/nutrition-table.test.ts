import { describe, expect, it } from "vitest";
import { dominantProvenance } from "./nutrition-table";

describe("dominantProvenance", () => {
  it("picks the provenance most nutrients share", () => {
    expect(dominantProvenance({ energyKcal: "label", protein: "label", sodiumMg: "estimate" })).toBe("label");
    expect(dominantProvenance({ energyKcal: "estimate", protein: "estimate", fat: "label" })).toBe("estimate");
  });
  it("breaks ties by first seen and defaults to reference", () => {
    expect(dominantProvenance({ energyKcal: "community", protein: "label" })).toBe("community");
    expect(dominantProvenance({})).toBe("reference");
  });
});
