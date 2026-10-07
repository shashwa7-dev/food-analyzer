import { describe, expect, it } from "vitest";
import { backAction } from "./back";

describe("backAction", () => {
  it("goes back only after an in-app navigation", () => {
    expect(backAction("1", "/today")).toEqual({ kind: "back" });
  });
  it("falls back to the given page when opened directly or storage is unavailable", () => {
    expect(backAction(null, "/today?date=2026-10-05")).toEqual({ kind: "push", href: "/today?date=2026-10-05" });
    expect(backAction("", "/today")).toEqual({ kind: "push", href: "/today" });
  });
});
