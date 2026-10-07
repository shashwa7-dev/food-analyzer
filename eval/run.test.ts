import { describe, expect, it } from "vitest";
import {
  type AttemptResult,
  type ExpectedFixture,
  fieldAccuracy,
  formatTable,
  meanCostMicros,
  parseExpected,
  percentile,
  renderSummaryTable,
  scoreField,
  schemaFailureRate,
  summarize,
  triageAccuracy,
} from "./run";

// --- Fakes: build an AttemptResult without ever calling extract()/triage()/toPer100(). ---

function attempt(overrides: Omit<Partial<AttemptResult>, "expected"> & { expected?: Partial<ExpectedFixture> } = {}): AttemptResult {
  const { expected, ...rest } = overrides;
  return {
    fixtureId: "f1",
    model: "fast",
    modelId: "gemini-3.5-flash-lite",
    latencyMs: 1000,
    costMicros: 100,
    schemaFailure: false,
    route: "label",
    per100: {},
    expected: { kind: "label", ...expected },
    ...rest,
  };
}

describe("scoreField", () => {
  it("skips when the fixture doesn't claim a value for this field", () => {
    expect(scoreField(undefined, undefined)).toBe("skip");
    expect(scoreField(123, undefined)).toBe("skip");
  });

  it("misses when expected is present but the model extracted nothing", () => {
    expect(scoreField(undefined, 100)).toBe("miss");
  });

  it("matches within ±5% of a nonzero expected value", () => {
    expect(scoreField(105, 100)).toBe("match"); // +5%, boundary
    expect(scoreField(95, 100)).toBe("match"); // -5%, boundary
    expect(scoreField(100, 100)).toBe("match");
  });

  it("misses outside ±5% of a nonzero expected value", () => {
    expect(scoreField(106, 100)).toBe("miss");
    expect(scoreField(94, 100)).toBe("miss");
  });

  it("treats an expected 0 as 'basically zero' (absolute tolerance, not relative)", () => {
    expect(scoreField(0, 0)).toBe("match");
    expect(scoreField(0.05, 0)).toBe("match"); // at the absolute threshold
    expect(scoreField(0.5, 0)).toBe("miss");
  });
});

describe("fieldAccuracy", () => {
  it("is null when nothing is gradable for that field", () => {
    const attempts = [attempt({ expected: { facts: {} } }), attempt({ expected: { facts: {} } })];
    expect(fieldAccuracy(attempts, "energyKcal")).toBeNull();
  });

  it("excludes skipped fixtures from the denominator", () => {
    const attempts = [
      attempt({ per100: { energyKcal: 100 }, expected: { facts: { energyKcal: 100 } } }), // match
      attempt({ per100: {}, expected: { facts: {} } }), // skip: fixture claims nothing
    ];
    expect(fieldAccuracy(attempts, "energyKcal")).toBe(1);
  });

  it("computes matches / graded", () => {
    const attempts = [
      attempt({ per100: { protein: 10 }, expected: { facts: { protein: 10 } } }), // match
      attempt({ per100: { protein: 50 }, expected: { facts: { protein: 10 } } }), // miss
      attempt({ per100: {}, expected: { facts: { protein: 10 } } }), // miss (model omitted it)
    ];
    expect(fieldAccuracy(attempts, "protein")).toBeCloseTo(1 / 3);
  });
});

describe("schemaFailureRate", () => {
  it("is 0 for an empty list", () => {
    expect(schemaFailureRate([])).toBe(0);
  });

  it("is the fraction of attempts with schemaFailure: true", () => {
    const attempts = [attempt({ schemaFailure: true }), attempt({ schemaFailure: false }), attempt({ schemaFailure: false }), attempt({ schemaFailure: false })];
    expect(schemaFailureRate(attempts)).toBe(0.25);
  });
});

describe("triageAccuracy", () => {
  it("is null when every attempt was a schema failure", () => {
    expect(triageAccuracy([attempt({ schemaFailure: true, route: null })])).toBeNull();
  });

  it("excludes schema failures, but grades image-level outcomes (not_food/unreadable) same as a route", () => {
    const attempts = [
      attempt({ route: "label", expected: { kind: "label" } }), // correct
      attempt({ route: "unreadable", expected: { kind: "label" } }), // wrong
      attempt({ schemaFailure: true, route: null, expected: { kind: "label" } }), // excluded
    ];
    expect(triageAccuracy(attempts)).toBe(0.5);
  });
});

describe("percentile", () => {
  it("returns 0 for an empty array", () => {
    expect(percentile([], 50)).toBe(0);
  });

  it("p50 of an odd-length array is the middle value", () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
  });

  it("p50 of an even-length array interpolates", () => {
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5);
  });

  it("p95 of ten evenly spaced values interpolates near the top", () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(values, 95)).toBeCloseTo(95.5);
  });

  it("does not mutate its input or require it pre-sorted", () => {
    const values = [5, 1, 3];
    expect(percentile(values, 50)).toBe(3);
    expect(values).toEqual([5, 1, 3]);
  });
});

describe("meanCostMicros", () => {
  it("is 0 for an empty list", () => {
    expect(meanCostMicros([])).toBe(0);
  });

  it("averages costMicros across attempts, including failed (0-cost) ones", () => {
    const attempts = [attempt({ costMicros: 100 }), attempt({ costMicros: 200 }), attempt({ schemaFailure: true, costMicros: 0 })];
    expect(meanCostMicros(attempts)).toBeCloseTo(100);
  });
});

describe("parseExpected", () => {
  it("rejects a missing or invalid kind", () => {
    expect(() => parseExpected({}, "x")).toThrow(/kind/);
    expect(() => parseExpected({ kind: "nonsense" }, "x")).toThrow(/kind/);
  });

  it("parses a full fixture", () => {
    const parsed = parseExpected(
      { kind: "label", name: "Aloo Bhujia", facts: { energyKcal: 536, protein: 8.4 }, basis: "per_100g" },
      "x",
    );
    expect(parsed).toEqual({ kind: "label", name: "Aloo Bhujia", facts: { energyKcal: 536, protein: 8.4 }, basis: "per_100g" });
  });

  it("drops a facts object whose fields are all non-numeric or unrecognised, leaving facts undefined", () => {
    expect(parseExpected({ kind: "meal", facts: { notARealField: 1 } }, "x").facts).toBeUndefined();
  });

  it("defaults optional fields to undefined", () => {
    expect(parseExpected({ kind: "barcode" }, "x")).toEqual({ kind: "barcode", name: undefined, facts: undefined, basis: undefined });
  });
});

describe("summarize", () => {
  it("aggregates schema-failure rate, triage accuracy, field accuracy, latency and cost for one model", () => {
    const attempts: AttemptResult[] = [
      attempt({
        latencyMs: 1000, costMicros: 100, route: "label",
        per100: { energyKcal: 100, protein: 10 },
        expected: { kind: "label", facts: { energyKcal: 100, protein: 10 } },
      }),
      attempt({
        latencyMs: 2000, costMicros: 300, route: "label",
        per100: { energyKcal: 50, protein: 10 }, // energyKcal way off, protein matches
        expected: { kind: "label", facts: { energyKcal: 100, protein: 10 } },
      }),
    ];
    const summary = summarize("fast", attempts);
    expect(summary.fixtures).toBe(2);
    expect(summary.schemaFailurePct).toBe(0);
    expect(summary.triageAccuracyPct).toBe(100);
    expect(summary.fieldAccuracyPct.energyKcal).toBe(50);
    expect(summary.fieldAccuracyPct.protein).toBe(100);
    expect(summary.fieldAccuracyPct.sugars).toBeNull();
    expect(summary.p50LatencyMs).toBe(1500);
    expect(summary.meanCostMicros).toBe(200);
    expect(summary.modelId).toBe("gemini-3.5-flash-lite");
  });

  it("falls back to a placeholder modelId when every attempt was a schema failure", () => {
    const summary = summarize("strong", [attempt({ model: "strong", modelId: null, schemaFailure: true, route: null })]);
    expect(summary.modelId).toBe("(strong)");
    expect(summary.schemaFailurePct).toBe(100);
    expect(summary.triageAccuracyPct).toBeNull();
  });
});

describe("formatTable", () => {
  it("pads columns to the widest cell (header or row) and separates header from rows", () => {
    const table = formatTable(["a", "bb"], [["1", "22"], ["333", "4"]]);
    const lines = table.split("\n");
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe("a    bb");
    expect(lines[1]).toBe("---  --");
    expect(lines[2]).toBe("1    22");
    expect(lines[3]).toBe("333  4 ");
  });
});

describe("renderSummaryTable", () => {
  it("renders a '—' for null metrics and percentages for the rest", () => {
    const summary = summarize("fast", [attempt({ schemaFailure: true, route: null })]);
    const table = renderSummaryTable([summary]);
    expect(table).toContain("fast");
    expect(table).toContain("100%"); // schema fail
    expect(table).toContain("—"); // triage accuracy: null (every attempt was a schema failure)
  });
});
