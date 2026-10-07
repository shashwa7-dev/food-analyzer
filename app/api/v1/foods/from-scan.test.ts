import { describe, expect, it } from "vitest";
import { extractFromScanId } from "./from-scan";

describe("extractFromScanId (POST /api/v1/foods body routing)", () => {
  it("is absent for a manual custom-food body or a missing/malformed JSON body", () => {
    expect(extractFromScanId({ name: "Protein bar" })).toEqual({ present: false, scanId: null });
    expect(extractFromScanId(null)).toEqual({ present: false, scanId: null });
    expect(extractFromScanId("just a string")).toEqual({ present: false, scanId: null });
  });

  it("extracts a well-formed scan id", () => {
    const id = "11111111-1111-4111-8111-111111111111"; // version 4, variant 8 — a well-formed UUID
    expect(extractFromScanId({ fromScanId: id })).toEqual({ present: true, scanId: id });
  });

  it("is present but has a null scanId for a malformed id — the route must 404, not fall through to the manual-food 400", () => {
    expect(extractFromScanId({ fromScanId: "not-a-uuid" })).toEqual({ present: true, scanId: null });
    expect(extractFromScanId({ fromScanId: 123 })).toEqual({ present: true, scanId: null });
  });
});
