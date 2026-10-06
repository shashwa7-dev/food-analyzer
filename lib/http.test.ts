import { describe, expect, it } from "vitest";
import { countryFrom } from "./http";

describe("countryFrom", () => {
  it("accepts only ISO alpha-2 codes", () => {
    expect(countryFrom(new Headers({ "x-vercel-ip-country": "IN" }))).toBe("IN");
    expect(countryFrom(new Headers({ "x-vercel-ip-country": "in" }))).toBeUndefined();
    expect(countryFrom(new Headers({ "x-vercel-ip-country": "XYZ" }))).toBeUndefined();
    expect(countryFrom(new Headers({ "x-vercel-ip-country": "<script>" }))).toBeUndefined();
    expect(countryFrom(new Headers())).toBeUndefined();
  });
});
