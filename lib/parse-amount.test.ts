import { describe, expect, it } from "vitest";
import { parseAmount } from "./parse-amount";

describe("parseAmount", () => {
  it("reads plain and spaced numbers, with a point anywhere", () => {
    expect(parseAmount("1800")).toBe(1800);
    expect(parseAmount(" 1 800 ")).toBe(1800);
    expect(parseAmount("2.5")).toBe(2.5);
    expect(parseAmount(".5")).toBe(0.5);
    expect(parseAmount("5.")).toBe(5);
    expect(parseAmount("0")).toBe(0);
  });
  it("reads a comma before three digits as grouping (western and lakh style)", () => {
    expect(parseAmount("1,800")).toBe(1800);
    expect(parseAmount("12,000")).toBe(12000);
    expect(parseAmount("1,234,567")).toBe(1234567);
    expect(parseAmount("1,80,000")).toBe(180000);
    expect(parseAmount("1,800.5")).toBe(1800.5);
  });
  it("reads a single comma before one or two digits as a decimal point", () => {
    expect(parseAmount("1,5")).toBe(1.5);
    expect(parseAmount("12,25")).toBe(12.25);
    expect(parseAmount("0,5")).toBe(0.5);
  });
  it("treats an empty field as not given", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("   ")).toBeNull();
  });
  it("rejects anything else", () => {
    for (const bad of ["abc", "12kg", "-5", ".", "1,8000", "1,800,00", "1,2,3", "1.2.3", ",5", "5,"]) expect(parseAmount(bad)).toBeNaN();
  });
});
