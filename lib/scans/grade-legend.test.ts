import { describe, expect, it } from "vitest";
import { GRADE_SHORT, gradeLegend } from "./grade-legend";
import { VERDICT } from "./result-display";

describe("gradeLegend", () => {
  it("lists A–E in order with the result screen's verdicts", () => {
    const rows = gradeLegend();
    expect(rows.map((r) => r.grade)).toEqual(["A", "B", "C", "D", "E"]);
    for (const r of rows) expect(r.verdict).toBe(VERDICT[r.grade]);
  });
  it("has one short word per grade for the chips", () => {
    expect(Object.values(GRADE_SHORT).every((w) => w.length > 0 && !w.includes(" "))).toBe(true);
    expect(gradeLegend()[0]).toMatchObject({ grade: "A", short: "Great" });
  });
});
