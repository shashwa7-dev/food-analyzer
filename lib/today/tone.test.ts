import { describe, expect, it } from "vitest";
import type { TargetProgress } from "@/lib/nutrition/totals";
import { limitAmount, limitChips, limitRows, limitsSummary, toneFor } from "./tone";

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

describe("limitRows", () => {
  it("lists sodium, sat fat and sugar in card order with a tone each, skipping fibre and missing limits", () => {
    const rows = limitRows([p("sugarsMax", 32, 50), p("fibre", 40, 30), p("satFatMax", 21, 22), p("sodiumMgMax", 2567, 2000)]);
    expect(rows.map((r) => [r.label, r.tone])).toEqual([["Sodium", "over"], ["Sat fat", "near"], ["Sugar", "ok"]]);
    expect(limitRows([p("sodiumMgMax", 100, 0)])).toEqual([]);
  });
  it("puts exactly 90% at near and exactly 100% at near, not over", () => {
    expect(limitRows([p("sugarsMax", 45, 50)])[0]?.tone).toBe("near");
    expect(limitRows([p("sugarsMax", 44.9, 50)])[0]?.tone).toBe("ok");
    expect(limitRows([p("sugarsMax", 50, 50)])[0]?.tone).toBe("near");
  });
});

describe("limitAmount", () => {
  it("rounds to whole numbers with Indian grouping", () => {
    expect(limitAmount(1543.4, 2000)).toBe("1,543 / 2,000");
    expect(limitAmount(21.2, 22)).toBe("21 / 22");
  });
  it("keeps one decimal when rounding would change the tone", () => {
    expect(limitAmount(22.3, 22)).toBe("22.3 / 22");
    expect(limitAmount(19.6, 22)).toBe("19.6 / 22"); // 89%, but "20 / 22" would read 91%
    expect(limitAmount(21.6, 22)).toBe("22 / 22"); // close either way
    expect(limitAmount(22, 22)).toBe("22 / 22");
    expect(limitAmount(44.9, 50)).toBe("44.9 / 50");
    expect(limitAmount(45.2, 50)).toBe("45 / 50");
  });
});

describe("limitsSummary", () => {
  const rows = (...xs: [TargetProgress["key"], number, number][]) => limitRows(xs.map(([k, t, l]) => p(k, t, l)));
  it("has no badge and no tip when every limit is under 90%", () => {
    expect(limitsSummary(rows(["sodiumMgMax", 1543, 2000], ["satFatMax", 15, 22], ["sugarsMax", 32, 50]))).toEqual({ badge: null, tip: null });
  });
  it("counts close limits and names the worst", () => {
    expect(limitsSummary(rows(["sodiumMgMax", 1543, 2000], ["satFatMax", 21, 22], ["sugarsMax", 32, 50]))).toEqual({
      badge: { tone: "near", count: 1, text: "1 close" },
      tip: "Sat fat is close to your 22 g limit.",
    });
  });
  it("lets over win the badge, counting only the over ones, and names the worst", () => {
    expect(limitsSummary(rows(["sodiumMgMax", 3053, 2000], ["satFatMax", 21, 22], ["sugarsMax", 46, 50]))).toEqual({
      badge: { tone: "over", count: 1, text: "1 over" },
      tip: "Sodium is over your 2,000 mg limit.",
    });
    expect(limitsSummary(rows(["sodiumMgMax", 2100, 2000], ["satFatMax", 25, 22]))?.badge?.text).toBe("2 over");
    expect(limitsSummary(rows(["sodiumMgMax", 2100, 2000], ["satFatMax", 25, 22])).tip).toBe("Sat fat is over your 22 g limit.");
  });
});
