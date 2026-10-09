import { describe, expect, it } from "vitest";
import { exerciseSummary, workoutWhen } from "./summary";

const NOW = new Date("2026-10-08T15:00:00Z"); // Thu 8 Oct, 20:30 in Kolkata
const TZ = "Asia/Kolkata";

describe("workoutWhen", () => {
  it("reads Today with the start and end wall times in the user's timezone", () => {
    expect(workoutWhen("2026-10-08T12:40:00Z", 48, TZ, NOW)).toBe("Today · 18:10 – 18:58");
  });
  it("uses the local calendar day, not UTC's", () => {
    // 19:00 UTC on the 7th is 00:30 on the 8th in Kolkata.
    expect(workoutWhen("2026-10-07T19:00:00Z", 30, TZ, NOW)).toBe("Today · 00:30 – 01:00");
    expect(workoutWhen("2026-10-07T12:00:00Z", 60, TZ, NOW)).toBe("Yesterday · 17:30 – 18:30");
  });
  it("names other days as 'Mon, 5 Oct', with the year only when it differs", () => {
    expect(workoutWhen("2026-10-05T03:30:00Z", 45, TZ, NOW)).toBe("Mon, 5 Oct · 09:00 – 09:45");
    expect(workoutWhen("2025-12-31T12:00:00Z", 30, TZ, NOW)).toBe("Wed, 31 Dec 2025 · 17:30 – 18:00");
  });
  it("crosses midnight on the end time and shows the start alone for zero minutes", () => {
    expect(workoutWhen("2026-10-08T18:00:00Z", 90, TZ, new Date("2026-10-08T20:00:00Z"))).toBe("Yesterday · 23:30 – 01:00");
    expect(workoutWhen("2026-10-08T12:40:00Z", 0, TZ, NOW)).toBe("Today · 18:10");
  });
});

const set = (weightKg: number | null, reps: number | null, done = true) => ({ weightKg, reps, done, position: 0 });

describe("exerciseSummary", () => {
  it("counts done sets at the heaviest done weight", () => {
    expect(exerciseSummary({ sets: [set(30, 10), set(35, 8), set(35, 6), set(40, 5, false)], best: { weightKg: 35, reps: 8, e1rm: 44 }, pr: false }))
      .toBe("3 × 35 kg");
  });
  it("adds the best set on a PR", () => {
    expect(exerciseSummary({ sets: [set(62.5, 8), set(62.5, 7), set(62.5, 6)], best: { weightKg: 62.5, reps: 8, e1rm: 79.2 }, pr: true }))
      .toBe("3 × 62.5 kg · best 62.5 × 8");
  });
  it("falls back to a set count without weights, and says when nothing was done", () => {
    expect(exerciseSummary({ sets: [set(null, 12), set(0, 10)], best: null, pr: false })).toBe("2 sets");
    expect(exerciseSummary({ sets: [set(null, 12)], best: null, pr: false })).toBe("1 set");
    expect(exerciseSummary({ sets: [set(60, 8, false)], best: null, pr: false })).toBe("No sets done");
    expect(exerciseSummary({ sets: [], best: null, pr: false })).toBe("No sets done");
  });
});
