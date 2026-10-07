import { describe, expect, it } from "vitest";
import { PRESETS } from "@/lib/nutrition/targets";
import { gatedTargetsWrite, sameOverrides, targetsToSave } from "./targets-gate";

const text = (o: Record<string, number | string>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)])) as never;

describe("sameOverrides", () => {
  it("ignores key order and undefined keys; null and {} are the same", () => {
    expect(sameOverrides({ protein: 90, sodiumMgMax: 1800 }, { sodiumMgMax: 1800, protein: 90 })).toBe(true);
    expect(sameOverrides({ protein: 90, fat: undefined }, { protein: 90 })).toBe(true);
    expect(sameOverrides({}, null)).toBe(true);
    expect(sameOverrides({ protein: 90 }, { protein: 91 })).toBe(false);
    expect(sameOverrides({ protein: 90 }, { protein: 90, fat: 60 })).toBe(false);
  });
});

describe("gatedTargetsWrite", () => {
  it("re-sending the stored overrides is unchanged", () => {
    expect(gatedTargetsWrite({ protein: 90 }, { protein: 90 }, "general")).toBe("unchanged");
  });
  it("values equal to the goal's preset are a return to the preset", () => {
    expect(gatedTargetsWrite({ sodiumMgMax: 1500 }, { protein: 90 }, "low_sodium")).toBe("preset");
    expect(gatedTargetsWrite({ ...PRESETS.general }, null, "general")).toBe("preset");
  });
  it("anything else is a custom change", () => {
    expect(gatedTargetsWrite({ protein: 95 }, { protein: 90 }, "general")).toBe("custom");
    expect(gatedTargetsWrite({ sodiumMgMax: 1500 }, null, "general")).toBe("custom");
  });
});

describe("targetsToSave", () => {
  const fields = text(PRESETS.general);
  it("leaves targets out without fields or without custom targets, even if the fields differ", () => {
    expect(targetsToSave(null, "general", true)).toEqual({ ok: true });
    expect(targetsToSave(text({ ...PRESETS.general, protein: 120 }), "general", false)).toEqual({ ok: true });
    expect("targets" in targetsToSave(fields, "general", false)).toBe(false);
  });
  it("sends only the fields that differ from the preset, or null", () => {
    expect(targetsToSave(fields, "general", true)).toEqual({ ok: true, targets: null });
    expect(targetsToSave(text({ ...PRESETS.general, protein: 120, sodiumMgMax: "1,800" }), "general", true))
      .toEqual({ ok: true, targets: { protein: 120, sodiumMgMax: 1800 } });
  });
  it("an empty field is the preset; a bad one is reported", () => {
    expect(targetsToSave(text({ ...PRESETS.general, protein: "" }), "general", true)).toEqual({ ok: true, targets: null });
    const res = targetsToSave(text({ ...PRESETS.general, fat: "abc" }), "general", true);
    expect(res.ok).toBe(false);
    expect(!res.ok && [...res.bad]).toEqual(["fat"]);
  });
});
