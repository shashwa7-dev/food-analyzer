import { describe, expect, it } from "vitest";
import { amountError, DECIMAL_COMMA_MESSAGE, parseAmount } from "./parse-amount";

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
  it("reads a single comma before exactly one digit as a decimal point", () => {
    expect(parseAmount("1,5")).toBe(1.5);
    expect(parseAmount("0,5")).toBe(0.5);
    expect(parseAmount("12,5")).toBe(12.5);
  });
  it("won't guess a comma before two digits (1.4 or 140?): NaN, with a message to use a dot", () => {
    for (const amb of ["1,40", "12,25", "0,50", " 1,40 "]) {
      expect(parseAmount(amb)).toBeNaN();
      expect(amountError(amb)).toBe(DECIMAL_COMMA_MESSAGE);
    }
    expect(DECIMAL_COMMA_MESSAGE).toBe("Use a dot for decimals, e.g. 1.4");
  });
  it("accepts Indian (lakh) grouping", () => {
    expect(parseAmount("1,00,000")).toBe(100000);
    expect(parseAmount("10,00,000")).toBe(1000000);
    expect(parseAmount("1,40,000")).toBe(140000); // two-digit groups are fine when they end in a three-digit one
  });
  it("treats an empty field as not given", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("   ")).toBeNull();
  });
  it("rejects anything else", () => {
    for (const bad of ["abc", "12kg", "-5", ".", "1,8000", "1,800,00", "1,2,3", "1.2.3", ",5", "5,"]) expect(parseAmount(bad)).toBeNaN();
  });
  it("amountError: null when the field parses or is empty, else why", () => {
    expect(amountError("1,800")).toBeNull();
    expect(amountError("1,5")).toBeNull();
    expect(amountError("")).toBeNull();
    expect(amountError("abc")).toBe("Enter a number");
    expect(amountError("1,8000")).toBe("Enter a number");
  });
});
