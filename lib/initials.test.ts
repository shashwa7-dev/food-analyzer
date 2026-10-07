import { describe, expect, it } from "vitest";
import { initialsOf } from "./initials";

describe("initialsOf", () => {
  it("takes the first letters of the first and last names", () => {
    expect(initialsOf("Aarav Kapoor")).toBe("AK");
    expect(initialsOf("aarav")).toBe("A");
    expect(initialsOf("Mary Jane Watson")).toBe("MW");
    expect(initialsOf("  ")).toBe("?");
  });
});
