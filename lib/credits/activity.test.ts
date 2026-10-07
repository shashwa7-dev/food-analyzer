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
      [{ at: "2026-10-03T06:00:00Z", amount: -1 }, { at: "2026-10-06T06:00:00Z", amount: -1 }],
      "2026-10-01", "2026-10-07", "Asia/Kolkata", 18,
    );
    expect(s).toHaveLength(7);
    expect(s[0]).toEqual({ date: "2026-10-01", balance: 20, event: false });
    expect(s[2]).toEqual({ date: "2026-10-03", balance: 19, event: true });
    expect(s[4].balance).toBe(19);
    expect(s[6]).toEqual({ date: "2026-10-07", balance: 18, event: false });
  });
  it("closes a day with several changes on their sum, whatever order they come in", () => {
    const debitThenRefund = [{ at: "2026-10-02T04:00:00Z", amount: -1 }, { at: "2026-10-02T04:00:00Z", amount: 1 }];
    for (const txns of [debitThenRefund, [...debitThenRefund].reverse()]) {
      const s = balanceSeries(txns, "2026-10-01", "2026-10-02", "Asia/Kolkata", 20);
      expect(s).toEqual([{ date: "2026-10-01", balance: 20, event: false }, { date: "2026-10-02", balance: 20, event: true }]);
    }
  });
  it("leaves changes from before the first local day out of the shown days", () => {
    // 00:30 UTC on 1 Oct is still 30 Sep in New York, but it belongs to October's (UTC) period.
    const s = balanceSeries([{ at: "2026-10-01T00:30:00Z", amount: -1 }], "2026-10-01", "2026-10-02", "America/New_York", 19);
    expect(s.map((p) => p.balance)).toEqual([19, 19]);
    expect(s[0]!.event).toBe(false);
  });
});
