import { describe, expect, it } from "vitest";
import { foodIconKey } from "./icon";

const f = (name: string, extra: Partial<Parameters<typeof foodIconKey>[0]> = {}) =>
  foodIconKey({ name, source: "indb", ...extra });

describe("foodIconKey", () => {
  it("uses package for packaged foods", () => {
    expect(f("Masala peanuts", { source: "off" })).toBe("package");
    expect(f("Anything", { barcode: "8901058000290" })).toBe("package");
  });
  it("uses drink for beverages", () => {
    expect(f("Masala chai", { gradeCategory: "beverage" })).toBe("drink");
    expect(f("Water", { gradeCategory: "water" })).toBe("drink");
  });
  it("maps Indian staples by keyword", () => {
    expect(f("Dal tadka")).toBe("bowl");
    expect(f("Jeera rice")).toBe("bowl");
    expect(f("Rajma curry")).toBe("bowl");
    expect(f("Roti (whole wheat)")).toBe("wheat");
    expect(f("Plain paratha")).toBe("wheat");
    expect(f("Toned milk")).toBe("milk");
    expect(f("Paneer bhurji")).toBe("milk");
    expect(f("Boiled egg")).toBe("egg");
    expect(f("Banana")).toBe("fruit");
    expect(f("Gulab jamun")).toBe("snack");
    expect(f("Samosa")).toBe("snack");
    expect(f("Masala Peanuts")).toBe("snack");
    // Spreads and oils aren't snacks.
    expect(f("Peanut butter")).not.toBe("snack");
    expect(f("Groundnut oil")).not.toBe("snack");
    expect(f("Roasted groundnuts")).toBe("snack");
    expect(f("Masala dosa")).toBe("wheat");
    expect(f("Idli")).toBe("bowl");
    expect(f("Medu vada")).toBe("snack");
    expect(f("Paneer tikka")).toBe("milk");
    expect(f("Egg curry")).toBe("egg");
  });
  it("falls back to default", () => {
    expect(f("Zzz unknown thing")).toBe("default");
  });
  it("is case and accent insensitive", () => {
    expect(f("DAL MAKHANI")).toBe("bowl");
  });
});
