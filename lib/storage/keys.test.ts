import { describe, expect, it } from "vitest";
import { photoKeys } from "./keys";
describe("photoKeys", () => {
  it("builds the two prefixes the lifecycle rule and account deletion rely on", () => {
    expect(photoKeys.display("u1", "s1", 1)).toBe("display/u/u1/s1/1.webp");
    expect(photoKeys.thumb("u1", "s1")).toBe("thumb/u/u1/s1.webp");
    expect(photoKeys.userPrefixes("u1")).toEqual(["display/u/u1/", "thumb/u/u1/"]);
  });
  it("keeps one scan's display copies under their own prefix", () => {
    expect(photoKeys.display("u1", "s1", 3).startsWith(photoKeys.scanDisplayPrefix("u1", "s1"))).toBe(true);
    expect(photoKeys.scanDisplayPrefix("u1", "s1").startsWith(photoKeys.userPrefixes("u1")[0])).toBe(true);
  });
});
