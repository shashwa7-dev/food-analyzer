// A live gym session as a pure reducer (spec §C screen 2). The session screen keeps this state in
// localStorage under `eatri8-workout-draft:{userId}` so a reload or app switch never loses it, and
// turns it into the POST /api/v1/workouts body on Finish.
import { PRESETS, exerciseByKey } from "@/lib/fitness/catalogue";
import type { Intensity, Preset, WorkoutDetail } from "@/lib/fitness/types";

export type DraftSet = { id: string; weightKg: number | null; reps: number | null; done: boolean };
export type DraftExercise = { id: string; exerciseKey: string | null; name: string; sets: DraftSet[] };
export type Draft = {
  version: 1;
  preset: Preset | null;
  title: string;
  /** ISO timestamp; the timer is always now − startedAt, so backgrounding never pauses it. */
  startedAt: string;
  date: string; // YYYY-MM-DD, the user's local day when the session started
  intensity: Intensity;
  exercises: DraftExercise[];
};

export type DraftAction =
  | { type: "addExercise"; exerciseKey: string | null; name: string }
  | { type: "removeExercise"; exerciseId: string }
  | { type: "moveExercise"; exerciseId: string; dir: -1 | 1 }
  | { type: "addSet"; exerciseId: string }
  | { type: "removeSet"; exerciseId: string; setId: string }
  | { type: "updateSet"; exerciseId: string; setId: string; patch: Partial<Pick<DraftSet, "weightKg" | "reps">> }
  | { type: "toggleDone"; exerciseId: string; setId: string }
  | { type: "setIntensity"; intensity: Intensity }
  | { type: "setTitle"; title: string };

let counter = 0;
/** Short unique ids for React keys; good enough within one draft. */
export const newId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

const emptySet = (): DraftSet => ({ id: newId(), weightKg: null, reps: null, done: false });

export function startDraft(p: { preset: Preset | null; startedAt: string; date: string }): Draft {
  const keys = p.preset ? PRESETS[p.preset].exercises : [];
  return {
    version: 1,
    preset: p.preset,
    title: p.preset ? PRESETS[p.preset].title : "Workout",
    startedAt: p.startedAt,
    date: p.date,
    intensity: "moderate",
    exercises: keys.map((k) => ({ id: newId(), exerciseKey: k, name: exerciseByKey(k)?.name ?? k, sets: [emptySet()] })),
  };
}

const mapEx = (d: Draft, id: string, f: (e: DraftExercise) => DraftExercise): Draft => ({ ...d, exercises: d.exercises.map((e) => (e.id === id ? f(e) : e)) });

export function draftReducer(d: Draft, a: DraftAction): Draft {
  switch (a.type) {
    case "addExercise":
      return { ...d, exercises: [...d.exercises, { id: newId(), exerciseKey: a.exerciseKey, name: a.name.trim(), sets: [emptySet()] }] };
    case "removeExercise":
      return { ...d, exercises: d.exercises.filter((e) => e.id !== a.exerciseId) };
    case "moveExercise": {
      const i = d.exercises.findIndex((e) => e.id === a.exerciseId);
      const j = i + a.dir;
      if (i < 0 || j < 0 || j >= d.exercises.length) return d;
      const next = [...d.exercises];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return { ...d, exercises: next };
    }
    case "addSet":
      // A new set copies the previous row's kg and reps (not its done state), the usual gym-log habit.
      return mapEx(d, a.exerciseId, (e) => {
        const last = e.sets.at(-1);
        return { ...e, sets: [...e.sets, { id: newId(), weightKg: last?.weightKg ?? null, reps: last?.reps ?? null, done: false }] };
      });
    case "removeSet":
      return mapEx(d, a.exerciseId, (e) => ({ ...e, sets: e.sets.filter((s) => s.id !== a.setId) }));
    case "updateSet":
      return mapEx(d, a.exerciseId, (e) => ({ ...e, sets: e.sets.map((s) => (s.id === a.setId ? { ...s, ...a.patch } : s)) }));
    case "toggleDone":
      return mapEx(d, a.exerciseId, (e) => ({ ...e, sets: e.sets.map((s) => (s.id === a.setId ? { ...s, done: !s.done } : s)) }));
    case "setIntensity":
      return { ...d, intensity: a.intensity };
    case "setTitle":
      return { ...d, title: a.title };
  }
}

/** Sets marked done across the session (the header's "9 sets"). */
export const doneSetCount = (d: Draft) => d.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);

/** Whole minutes from startedAt to now, never negative. */
export function elapsedMinutes(d: Draft, now: Date = new Date()): number {
  const ms = now.getTime() - new Date(d.startedAt).getTime();
  return Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 60_000) : 0;
}

/** The exercises of a create or update body: only those with at least one set that has a weight or reps. */
function bodyExercises(d: Draft) {
  return d.exercises
    .map((e) => ({ e, sets: e.sets.filter((s) => s.weightKg !== null || s.reps !== null) }))
    .filter(({ sets }) => sets.length > 0)
    .map(({ e, sets }) => ({
      ...(e.exerciseKey ? { exerciseKey: e.exerciseKey } : {}),
      name: e.name,
      sets: sets.map((s) => ({ weightKg: s.weightKg, reps: s.reps, done: s.done })),
    }));
}

/** The POST /api/v1/workouts body. Only exercises with at least one set that has a weight or reps are sent. */
export function toCreateBody(d: Draft, now: Date = new Date()) {
  const exercises = bodyExercises(d);
  return {
    kind: "gym" as const,
    date: d.date,
    preset: d.preset,
    title: d.title.trim() || "Workout",
    intensity: d.intensity,
    startedAt: d.startedAt,
    durationMin: Math.min(600, elapsedMinutes(d, now)),
    exercises,
  };
}

/**
 * A saved gym workout as a draft, for editing it in the session screen (`/workouts/{id}/edit`). Custom
 * exercises (`custom:<slug>`) go back to a null key with their name, as when they were added.
 */
export function draftFromWorkout(w: WorkoutDetail): Draft {
  return {
    version: 1,
    preset: w.preset,
    title: w.title,
    startedAt: w.startedAt,
    date: w.date,
    intensity: w.intensity,
    exercises: [...w.exercises].sort((a, b) => a.position - b.position).map((e) => ({
      id: `e${e.position}`,
      exerciseKey: e.exerciseKey.startsWith("custom:") ? null : e.exerciseKey,
      name: e.name,
      sets: [...e.sets].sort((a, b) => a.position - b.position)
        .map((s) => ({ id: `e${e.position}s${s.position}`, weightKg: s.weightKg, reps: s.reps, done: s.done })),
    })),
  };
}

/** The PATCH /api/v1/workouts/{id} body from an edited draft: title, minutes, intensity and the whole exercise list. */
export function toUpdateBody(d: Draft, durationMin: number) {
  return {
    title: d.title.trim() || "Workout",
    durationMin: Math.min(600, Math.max(0, Math.round(durationMin))),
    intensity: d.intensity,
    exercises: bodyExercises(d),
  };
}

/** Parses a stored draft; anything malformed or from another version returns null (start fresh). */
export function restoreDraft(json: string | null): Draft | null {
  if (!json) return null;
  try {
    const d = JSON.parse(json) as Partial<Draft>;
    if (d?.version !== 1 || typeof d.startedAt !== "string" || typeof d.date !== "string" || !Array.isArray(d.exercises)) return null;
    if (Number.isNaN(new Date(d.startedAt).getTime())) return null;
    return d as Draft;
  } catch {
    return null;
  }
}

export const draftKey = (userId: string) => `eatri8-workout-draft:${userId}`;
