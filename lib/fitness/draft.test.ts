import { describe, expect, it } from "vitest";
import { doneSetCount, draftReducer, elapsedMinutes, restoreDraft, startDraft, toCreateBody, type Draft } from "./draft";

const start = () => startDraft({ preset: "push", startedAt: "2026-10-08T12:00:00.000Z", date: "2026-10-08" });

describe("startDraft", () => {
  it("fills a preset's exercises, each with one empty set", () => {
    const d = start();
    expect(d.title).toBe("Push day");
    expect(d.exercises).toHaveLength(5);
    expect(d.exercises.every((e) => e.sets.length === 1 && e.sets[0]!.weightKg === null)).toBe(true);
  });
  it("starts an empty session with no exercises", () => {
    expect(startDraft({ preset: null, startedAt: "2026-10-08T12:00:00.000Z", date: "2026-10-08" }).exercises).toEqual([]);
  });
});

describe("draftReducer", () => {
  it("adding a set copies the previous kg and reps but not done", () => {
    let d = start();
    const ex = d.exercises[0]!;
    d = draftReducer(d, { type: "updateSet", exerciseId: ex.id, setId: ex.sets[0]!.id, patch: { weightKg: 60, reps: 8 } });
    d = draftReducer(d, { type: "toggleDone", exerciseId: ex.id, setId: ex.sets[0]!.id });
    d = draftReducer(d, { type: "addSet", exerciseId: ex.id });
    const sets = d.exercises[0]!.sets;
    expect(sets).toHaveLength(2);
    expect(sets[1]).toMatchObject({ weightKg: 60, reps: 8, done: false });
    expect(doneSetCount(d)).toBe(1);
  });
  it("removes a set and an exercise", () => {
    let d = start();
    const ex = d.exercises[1]!;
    d = draftReducer(d, { type: "removeSet", exerciseId: ex.id, setId: ex.sets[0]!.id });
    expect(d.exercises[1]!.sets).toHaveLength(0);
    d = draftReducer(d, { type: "removeExercise", exerciseId: ex.id });
    expect(d.exercises).toHaveLength(4);
  });
  it("reorders exercises and ignores moves past either end", () => {
    let d = start();
    const [a, b] = [d.exercises[0]!.id, d.exercises[1]!.id];
    d = draftReducer(d, { type: "moveExercise", exerciseId: a, dir: 1 });
    expect(d.exercises.slice(0, 2).map((e) => e.id)).toEqual([b, a]);
    expect(draftReducer(d, { type: "moveExercise", exerciseId: b, dir: -1 })).toBe(d);
  });
  it("adds a custom exercise by name", () => {
    const d = draftReducer(start(), { type: "addExercise", exerciseKey: null, name: "  Cable fly  " });
    expect(d.exercises.at(-1)).toMatchObject({ exerciseKey: null, name: "Cable fly" });
  });
});

describe("toCreateBody", () => {
  it("sends only exercises with a set that has kg or reps, and the elapsed minutes", () => {
    let d = start();
    const ex = d.exercises[0]!;
    d = draftReducer(d, { type: "updateSet", exerciseId: ex.id, setId: ex.sets[0]!.id, patch: { weightKg: 62.5, reps: 8 } });
    d = draftReducer(d, { type: "toggleDone", exerciseId: ex.id, setId: ex.sets[0]!.id });
    const body = toCreateBody(d, new Date("2026-10-08T12:48:30.000Z"));
    expect(body).toMatchObject({ kind: "gym", date: "2026-10-08", preset: "push", title: "Push day", durationMin: 48 });
    expect(body.exercises).toEqual([{ exerciseKey: ex.exerciseKey, name: ex.name, sets: [{ weightKg: 62.5, reps: 8, done: true }] }]);
  });
  it("caps the duration at 600 minutes and never goes negative", () => {
    expect(toCreateBody(start(), new Date("2026-10-09T12:00:00.000Z")).durationMin).toBe(600);
    expect(elapsedMinutes(start(), new Date("2026-10-08T11:00:00.000Z"))).toBe(0);
  });
});

describe("restoreDraft", () => {
  it("round-trips a draft", () => {
    const d = start();
    expect(restoreDraft(JSON.stringify(d))).toEqual(d);
  });
  it("returns null for nothing, bad JSON, another version or a bad date", () => {
    expect(restoreDraft(null)).toBeNull();
    expect(restoreDraft("{")).toBeNull();
    expect(restoreDraft(JSON.stringify({ ...start(), version: 2 }))).toBeNull();
    expect(restoreDraft(JSON.stringify({ ...start(), startedAt: "nope" } as unknown as Draft))).toBeNull();
  });
});
