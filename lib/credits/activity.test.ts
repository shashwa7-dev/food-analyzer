import { describe, expect, it } from "vitest";
import { balanceSeries, groupActivity, type ActivityItem } from "./activity";

const item = (id: string, at: string, kind: ActivityItem["kind"] = "used"): ActivityItem =>
  ({ id, kind, at, title: id, meta: "", amount: kind === "used" ? -1 : kind === "free" ? 0 : 1, scanId: null, linkable: false });

describe("groupActivity", () => {
  const now = new Date("2026-10-07T06:30:00Z"); // 12:00 IST on 7 Oct
  it("labels Today, Yesterday, then d Mon, newest first, in the user's timezone", () => {
    const g = groupActivity([
      item("a", "2026-10-07T05:00:00Z"),
      item("b", "2026-10-06T19:00:00Z"), // 00:30 IST on 7 Oct → Today
      item("c", "2026-10-06T10:00:00Z"),
      item("d", "2026-10-04T10:00:00Z"),
    ], "Asia/Kolkata", now);
    expect(g.map((x) => x.label)).toEqual(["Today", "Yesterday", "4 Oct"]);
    expect(g[0].items.map((i) => i.id)).toEqual(["a", "b"]);
  });
  it("returns an empty list for no items", () => {
    expect(groupActivity([], "Asia/Kolkata", now)).toEqual([]);
  });
  it("keeps the server's order for rows that share a timestamp", () => {
    const g = groupActivity([item("debit", "2026-10-07T05:00:00.000Z"), item("grant", "2026-10-07T05:00:00.000Z", "grant")], "Asia/Kolkata", now);
    expect(g[0].items.map((i) => i.id)).toEqual(["debit", "grant"]);
  });
});

describe("balanceSeries", () => {
  it("steps the balance by day with event markers and stops at today", () => {
    const s = balanceSeries(
      [{ at: "2026-10-03T06:00:00Z", balanceAfter: 19 }, { at: "2026-10-06T06:00:00Z", balanceAfter: 18 }],
      "2026-10-01", "2026-10-07", "Asia/Kolkata", 20,
    );
    expect(s).toHaveLength(7);
    expect(s[0]).toEqual({ date: "2026-10-01", balance: 20, event: false });
    expect(s[2]).toEqual({ date: "2026-10-03", balance: 19, event: true });
    expect(s[4].balance).toBe(19);
    expect(s[6]).toEqual({ date: "2026-10-07", balance: 18, event: false });
  });
  it("uses the last balance of a day with several events", () => {
    const s = balanceSeries(
      [{ at: "2026-10-02T04:00:00Z", balanceAfter: 19 }, { at: "2026-10-02T05:00:00Z", balanceAfter: 20 }],
      "2026-10-01", "2026-10-02", "Asia/Kolkata", 20,
    );
    expect(s[1]).toEqual({ date: "2026-10-02", balance: 20, event: true });
  });
  it("folds events from before the first local day into the starting balance", () => {
    // 00:30 UTC on 1 Oct is still 30 Sep in New York, but it belongs to October's (UTC) period.
    const s = balanceSeries([{ at: "2026-10-01T00:30:00Z", balanceAfter: 19 }], "2026-10-01", "2026-10-02", "America/New_York", 20);
    expect(s.map((p) => p.balance)).toEqual([19, 19]);
    expect(s[0]!.event).toBe(false);
  });
});
