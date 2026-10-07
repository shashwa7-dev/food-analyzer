import { describe, expect, it } from "vitest";
import { parseTarget } from "./parse-target";

describe("parseTarget", () => {
  it("reads grouped and spaced numbers", () => {
    expect(parseTarget("1,800")).toBe(1800);
    expect(parseTarget(" 1 800 ")).toBe(1800);
    expect(parseTarget("2.5")).toBe(2.5);
  });
  it("reads a leading or trailing point and a decimal comma", () => {
    expect(parseTarget(".5")).toBe(0.5);
    expect(parseTarget("5.")).toBe(5);
    expect(parseTarget("1,5")).toBe(1.5);
  });
  it("treats an empty field as the preset", () => {
    expect(parseTarget("")).toBeNull();
    expect(parseTarget("  ")).toBeNull();
  });
  it("flags anything that isn't a number", () => {
    expect(parseTarget("abc")).toBeNaN();
    expect(parseTarget("12kg")).toBeNaN();
    expect(parseTarget("-5")).toBeNaN();
  });
});
