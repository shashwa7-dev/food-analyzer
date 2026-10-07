import { describe, expect, it } from "vitest";
import type { TargetProgress } from "@/lib/nutrition/totals";
import { limitChips, toneFor } from "./tone";

const p = (key: TargetProgress["key"], total: number, target: number): TargetProgress =>
  ({ key, label: key, total, target, kind: "limit", remaining: Math.max(0, target - total), overBy: Math.max(0, total - target) });

describe("toneFor", () => {
  it("is over only above the target", () => {
    expect(toneFor(2300, 2050)).toBe("over");
    expect(toneFor(2050, 2050)).toBe("ok");
    expect(toneFor(100, 2050)).toBe("ok");
    expect(toneFor(10, 0)).toBe("ok");
  });
});

describe("limitChips", () => {
  it("hides limits under 90% and ignores fibre", () => {
    expect(limitChips([p("sugarsMax", 44, 50), p("sodiumMgMax", 1000, 2000), p("satFatMax", 5, 20), p("fibre", 40, 30)])).toEqual([]);
  });
  it("marks 90–100% as near", () => {
    expect(limitChips([p("sugarsMax", 45, 50)])).toEqual([{ key: "sugarsMax", label: "Sugar", total: 45, target: 50, unit: "g", ratio: 0.9, tone: "near" }]);
    expect(limitChips([p("sodiumMgMax", 2000, 2000)])[0]?.tone).toBe("near");
  });
  it("marks above 100% as over", () => {
    expect(limitChips([p("sodiumMgMax", 2567, 2000)])).toMatchObject([{ label: "Sodium", unit: "mg", tone: "over" }]);
  });
  it("orders worst first", () => {
    const chips = limitChips([p("sugarsMax", 46, 50), p("sodiumMgMax", 3053, 2000), p("satFatMax", 25, 20)]);
    expect(chips.map((c) => c.key)).toEqual(["sodiumMgMax", "satFatMax", "sugarsMax"]);
  });
});
