import { describe, expect, it } from "vitest";
import { photoKeys } from "./keys";
describe("photoKeys", () => {
  it("keeps a scan's one image under the user's prefix", () => {
    expect(photoKeys.thumb("u1", "s1")).toBe("thumb/u/u1/s1.webp");
    expect(photoKeys.userPrefix("u1")).toBe("thumb/u/u1/");
    expect(photoKeys.thumb("u1", "s1").startsWith(photoKeys.userPrefix("u1"))).toBe(true);
  });
});
