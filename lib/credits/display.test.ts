import { describe, expect, it } from "vitest";
import { creditsState } from "./display";
describe("creditsState", () => {
  it("is ok above 3", () => { expect(creditsState(4)).toBe("ok"); expect(creditsState(20)).toBe("ok"); });
  it("is low at 1–3", () => { expect(creditsState(3)).toBe("low"); expect(creditsState(1)).toBe("low"); });
  it("is empty at 0 or below", () => { expect(creditsState(0)).toBe("empty"); expect(creditsState(-1)).toBe("empty"); });
});
