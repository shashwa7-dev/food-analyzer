import { describe, expect, it } from "vitest";
import { doneSetCount, draftFromWorkout, draftReducer, elapsedMinutes, restoreDraft, startDraft, toCreateBody, toUpdateBody, type Draft } from "./draft";

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

describe("draftFromWorkout and toUpdateBody", () => {
  const w = {
    id: "w1", date: "2026-10-08", kind: "gym", preset: "push", activity: null, title: "Push day", intensity: "hard",
    startedAt: "2026-10-08T12:40:00.000Z", durationMin: 48, kcalBurned: 310, kcalEstimated: true, exerciseCount: 2, setCount: 2, volumeKg: 900,
    notes: null, kcalBasis: { met: 5, weightKg: 70, estimated: true, minutes: 48 }, prCount: 0, createdAt: "", updatedAt: "",
    exercises: [
      { position: 1, exerciseKey: "custom:cable-fly", name: "Cable fly", best: null, pr: false, sets: [{ position: 0, weightKg: 15, reps: 12, done: false }] },
      { position: 0, exerciseKey: "bench_press", name: "Bench press", best: null, pr: false, sets: [
        { position: 1, weightKg: 62.5, reps: 7, done: true }, { position: 0, weightKg: 62.5, reps: 8, done: true },
      ] },
    ],
  } as const;

  it("rebuilds the exercises and sets in order, custom ones by name", () => {
    const d = draftFromWorkout(w as unknown as Parameters<typeof draftFromWorkout>[0]);
    expect(d).toMatchObject({ version: 1, preset: "push", title: "Push day", startedAt: w.startedAt, date: "2026-10-08", intensity: "hard" });
    expect(d.exercises.map((e) => [e.exerciseKey, e.name])).toEqual([["bench_press", "Bench press"], [null, "Cable fly"]]);
    expect(d.exercises[0]!.sets.map((s) => s.reps)).toEqual([8, 7]);
    expect(new Set(d.exercises.flatMap((e) => [e.id, ...e.sets.map((s) => s.id)])).size).toBe(5);
  });
  it("turns an edited draft into the PATCH body with the given minutes", () => {
    const d = draftFromWorkout(w as unknown as Parameters<typeof draftFromWorkout>[0]);
    const body = toUpdateBody({ ...d, title: "  " }, 52.4);
    expect(body).toEqual({
      title: "Workout", durationMin: 52, intensity: "hard",
      exercises: [
        { exerciseKey: "bench_press", name: "Bench press", sets: [{ weightKg: 62.5, reps: 8, done: true }, { weightKg: 62.5, reps: 7, done: true }] },
        { name: "Cable fly", sets: [{ weightKg: 15, reps: 12, done: false }] },
      ],
    });
    expect(toUpdateBody(d, 900).durationMin).toBe(600);
  });
});
