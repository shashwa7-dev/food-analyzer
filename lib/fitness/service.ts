// Workouts (spec §C "API"): owner-scoped, zod-validated, transactional writes, soft delete. kcal_burned
// is always computed here, from the latest body weight on or before the workout's date.
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lte, gte, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db, type Db, type Tx } from "@/lib/db/client";
import { bodyWeight, profile, workout, workoutExercise, workoutSet } from "@/lib/db/schema";
import { addDays, DateSchema, todayIn } from "@/lib/dates";
import { InvalidError } from "@/lib/errors";
import { kcalBurned } from "@/lib/fitness/burn";
import { ACTIVITIES, customExerciseKey, exerciseByKey, PRESETS } from "@/lib/fitness/catalogue";
import { bestSet, isPr, upNext, weekBounds, weekSummary } from "@/lib/fitness/stats";
import {
  ACTIVITY_KEYS, INTENSITIES, PRESET_KEYS,
  type FitnessSettings, type FitnessSummary, type KcalBasis, type Preset, type PreviousSets, type WorkoutDetail, type WorkoutExercise,
  type WorkoutListItem, type WorkoutSet,
} from "@/lib/fitness/types";
import { getProfile } from "@/lib/profile/service";

type Q = Db | Tx;
type WorkoutRow = typeof workout.$inferSelect;

/** Workouts the user can see: theirs and not soft-deleted. */
export function visibleWorkoutWhere(userId: string): SQL {
  return and(eq(workout.userId, userId), isNull(workout.deletedAt))!;
}

/** A calendar date (any year), for list and summary ranges. */
export const PlainDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => {
  const t = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
}, { message: "Use a date as YYYY-MM-DD." });

const SetInput = z.object({
  weightKg: z.number().min(0).max(500).nullable(),
  reps: z.number().int().min(0).max(100).nullable(),
  done: z.boolean(),
});
/** A catalogue exercise by key, or a custom one by name (stored under `custom:<slug>`). */
const ExerciseInput = z.object({
  exerciseKey: z.string().trim().min(1).max(80).optional(),
  name: z.string().trim().min(1).max(80).optional(),
  sets: z.array(SetInput).max(30),
}).refine((e) => (e.exerciseKey && exerciseByKey(e.exerciseKey)) || e.name, { message: "Pick an exercise or give it a name." });
const Title = z.string().trim().min(1).max(80);
const Notes = z.string().trim().max(1000).nullable();
const Minutes = z.number().int().min(0).max(600);
const StartedAt = z.iso.datetime({ offset: true });

export const CreateWorkoutSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("gym"), date: DateSchema, preset: z.enum(PRESET_KEYS).nullable().optional(), title: Title.optional(),
    intensity: z.enum(INTENSITIES).default("moderate"), startedAt: StartedAt.optional(), durationMin: Minutes,
    notes: Notes.optional(), exercises: z.array(ExerciseInput).max(30),
  }),
  z.object({
    kind: z.literal("activity"), date: DateSchema, activity: z.enum(ACTIVITY_KEYS), title: Title.optional(),
    intensity: z.enum(INTENSITIES), startedAt: StartedAt.optional(), durationMin: Minutes.min(1), notes: Notes.optional(),
  }),
]);
export type CreateWorkoutInput = z.input<typeof CreateWorkoutSchema>;

/** PATCH: the given fields replace the stored ones; `exercises` replaces the whole list (gym only). */
export const UpdateWorkoutSchema = z.object({
  title: Title.optional(), durationMin: Minutes.optional(), intensity: z.enum(INTENSITIES).optional(),
  notes: Notes.optional(), exercises: z.array(ExerciseInput).max(30).optional(),
});
export type UpdateWorkoutInput = z.input<typeof UpdateWorkoutSchema>;

const round2 = (n: number) => Math.round(n * 100) / 100;
const isUuid = (id: string) => z.uuid().safeParse(id).success;

/** The latest logged body weight on or before `date`, or null. */
export async function weightOn(q: Q, userId: string, date: string): Promise<number | null> {
  const [row] = await q.select({ kg: bodyWeight.kg }).from(bodyWeight)
    .where(and(eq(bodyWeight.userId, userId), lte(bodyWeight.date, date))).orderBy(desc(bodyWeight.date)).limit(1);
  return row?.kg ?? null;
}

async function burnFor(q: Q, userId: string, w: { kind: "gym" | "activity"; activity: WorkoutRow["activity"]; intensity: WorkoutRow["intensity"]; durationMin: number; date: string }) {
  const b = kcalBurned({ kind: w.kind === "gym" ? "gym" : w.activity!, intensity: w.intensity, minutes: w.durationMin, weightKg: await weightOn(q, userId, w.date) });
  const basis: KcalBasis = { met: b.met, weightKg: b.weightKg, estimated: b.estimated, minutes: w.durationMin };
  return { kcalBurned: b.kcal, kcalBasis: basis };
}

type ExerciseIn = z.infer<typeof ExerciseInput>;
function resolveExercise(e: ExerciseIn): { exerciseKey: string; name: string } {
  const known = e.exerciseKey ? exerciseByKey(e.exerciseKey) : undefined;
  if (known) return { exerciseKey: known.key, name: known.name };
  if (!e.name) throw new InvalidError("Pick an exercise or give it a name.");
  return { exerciseKey: customExerciseKey(e.name), name: e.name };
}

async function insertExercises(tx: Tx, workoutId: string, exercises: ExerciseIn[]) {
  if (!exercises.length) return;
  const rows = await tx.insert(workoutExercise)
    .values(exercises.map((e, position) => ({ workoutId, position, ...resolveExercise(e) })))
    .returning({ id: workoutExercise.id, position: workoutExercise.position });
  const idAt = new Map(rows.map((r) => [r.position, r.id]));
  const sets = exercises.flatMap((e, i) => e.sets.map((s, position) => ({
    exerciseId: idAt.get(i)!, position, weightKg: s.weightKg === null ? null : round2(s.weightKg), reps: s.reps, done: s.done,
  })));
  if (sets.length) await tx.insert(workoutSet).values(sets);
}

export async function createWorkout(userId: string, raw: CreateWorkoutInput, now: Date = new Date()): Promise<WorkoutDetail> {
  const input = CreateWorkoutSchema.parse(raw);
  const startedAt = input.startedAt ? new Date(input.startedAt) : now;
  const id = await db.transaction(async (tx) => {
    const base = input.kind === "gym"
      ? { kind: "gym" as const, preset: input.preset ?? null, activity: null, title: input.title ?? (input.preset ? PRESETS[input.preset].title : "Workout") }
      : { kind: "activity" as const, preset: null, activity: input.activity, title: input.title ?? ACTIVITIES[input.activity].title };
    const burn = await burnFor(tx, userId, { ...base, intensity: input.intensity, durationMin: input.durationMin, date: input.date });
    const [row] = await tx.insert(workout).values({
      userId, date: input.date, ...base, intensity: input.intensity, startedAt, durationMin: input.durationMin, notes: input.notes ?? null, ...burn,
    }).returning({ id: workout.id });
    if (input.kind === "gym") await insertExercises(tx, row!.id, input.exercises);
    return row!.id;
  });
  return (await getWorkout(userId, id))!;
}

/** Edits a workout and recomputes its kcal (the duration, intensity or the weight on its date may have changed). Null when not found. */
export async function updateWorkout(userId: string, id: string, raw: UpdateWorkoutInput): Promise<WorkoutDetail | null> {
  if (!isUuid(id)) return null;
  const patch = UpdateWorkoutSchema.parse(raw);
  const found = await db.transaction(async (tx) => {
    const [cur] = await tx.select().from(workout).where(and(eq(workout.id, id), visibleWorkoutWhere(userId))).for("update");
    if (!cur) return false;
    if (patch.exercises && cur.kind !== "gym") throw new InvalidError("Only gym sessions have exercises.");
    const next = {
      title: patch.title ?? cur.title, durationMin: patch.durationMin ?? cur.durationMin, intensity: patch.intensity ?? cur.intensity,
      notes: patch.notes === undefined ? cur.notes : patch.notes,
    };
    if (cur.kind === "activity" && next.durationMin < 1) throw new InvalidError("An activity needs at least a minute.");
    const burn = await burnFor(tx, userId, { ...cur, ...next });
    await tx.update(workout).set({ ...next, ...burn, updatedAt: new Date() }).where(eq(workout.id, id));
    if (patch.exercises) {
      await tx.delete(workoutExercise).where(eq(workoutExercise.workoutId, id)); // sets cascade
      await insertExercises(tx, id, patch.exercises);
    }
    return true;
  });
  return found ? getWorkout(userId, id) : null;
}

export async function deleteWorkout(userId: string, id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const rows = await db.update(workout).set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(workout.id, id), visibleWorkoutWhere(userId))).returning({ id: workout.id });
  return rows.length === 1;
}

const listColumns = {
  row: workout,
  exerciseCount: sql<number>`(SELECT count(*)::int FROM ${workoutExercise} e WHERE e.workout_id = "workout"."id")`,
  setCount: sql<number>`(SELECT count(*)::int FROM ${workoutSet} s JOIN ${workoutExercise} e ON e.id = s.exercise_id WHERE e.workout_id = "workout"."id" AND s.done)`,
  volume: sql<string>`(SELECT coalesce(sum(s.weight_kg * s.reps), 0)::text FROM ${workoutSet} s JOIN ${workoutExercise} e ON e.id = s.exercise_id WHERE e.workout_id = "workout"."id" AND s.done)`,
};

function toListItem(r: { row: WorkoutRow; exerciseCount: number; setCount: number; volume: string }): WorkoutListItem {
  const w = r.row;
  return {
    id: w.id, date: w.date, kind: w.kind, preset: w.preset, activity: w.activity, title: w.title, intensity: w.intensity,
    startedAt: w.startedAt.toISOString(), durationMin: w.durationMin, kcalBurned: w.kcalBurned, kcalEstimated: w.kcalBasis.estimated,
    exerciseCount: r.exerciseCount, setCount: r.setCount, volumeKg: round2(Number(r.volume)),
  };
}

/** Newest first: by date, then start time. */
async function queryList(userId: string, opts: { from?: string; to?: string; limit?: number }): Promise<WorkoutListItem[]> {
  const q = db.select(listColumns).from(workout)
    .where(and(visibleWorkoutWhere(userId), opts.from ? gte(workout.date, opts.from) : undefined, opts.to ? lte(workout.date, opts.to) : undefined))
    .orderBy(desc(workout.date), desc(workout.startedAt), desc(workout.createdAt));
  const rows = opts.limit ? await q.limit(opts.limit) : await q;
  return rows.map(toListItem);
}

export const ListQuerySchema = z.object({ from: PlainDateSchema.optional(), to: PlainDateSchema.optional() });

/** GET /api/v1/workouts: `from`–`to` inclusive (default the 30 days to today in the user's timezone), at most 366 days. */
export async function listWorkouts(userId: string, raw: z.input<typeof ListQuerySchema> = {}, now: Date = new Date()): Promise<WorkoutListItem[]> {
  const q = ListQuerySchema.parse(raw);
  const to = q.to ?? todayIn((await getProfile(userId)).timezone, now);
  const from = q.from ?? addDays(to, -29);
  if (from > to) throw new InvalidError("Pick a start date before the end date.");
  if (addDays(from, 366) <= to) throw new InvalidError("Pick at most a year of workouts.");
  return queryList(userId, { from, to });
}

/** The best earlier e1RM per exercise key, over the user's visible workouts before `w`. */
async function earlierBests(userId: string, w: WorkoutRow, keys: string[]): Promise<Map<string, number>> {
  if (!keys.length) return new Map();
  const rows = await db.select({
    key: workoutExercise.exerciseKey,
    best: sql<string>`max(${workoutSet.weightKg} * (1 + ${workoutSet.reps}::numeric / 30))::text`,
  }).from(workoutSet)
    .innerJoin(workoutExercise, eq(workoutSet.exerciseId, workoutExercise.id))
    .innerJoin(workout, eq(workoutExercise.workoutId, workout.id))
    .where(and(
      visibleWorkoutWhere(userId), inArray(workoutExercise.exerciseKey, keys), sql`${workout.id} <> ${w.id}`,
      eq(workoutSet.done, true), gt(workoutSet.weightKg, 0), gt(workoutSet.reps, 0),
      sql`(${workout.date}, ${workout.startedAt}, ${workout.createdAt}) < (${w.date}::date, ${w.startedAt.toISOString()}::timestamptz, ${w.createdAt.toISOString()}::timestamptz)`,
    ))
    .groupBy(workoutExercise.exerciseKey);
  return new Map(rows.map((r) => [r.key, Number(r.best)]));
}

/** One workout with its exercises, sets, best sets and PR flags; null when not found or not the user's. */
export async function getWorkout(userId: string, id: string): Promise<WorkoutDetail | null> {
  if (!isUuid(id)) return null;
  const [r] = await db.select(listColumns).from(workout).where(and(eq(workout.id, id), visibleWorkoutWhere(userId)));
  if (!r) return null;
  const w = r.row;
  const exRows = await db.select().from(workoutExercise).where(eq(workoutExercise.workoutId, id)).orderBy(asc(workoutExercise.position));
  const setRows = exRows.length
    ? await db.select().from(workoutSet).where(inArray(workoutSet.exerciseId, exRows.map((e) => e.id))).orderBy(asc(workoutSet.position))
    : [];
  const bests = await earlierBests(userId, w, [...new Set(exRows.map((e) => e.exerciseKey))]);
  const exercises: WorkoutExercise[] = exRows.map((e) => {
    const sets: WorkoutSet[] = setRows.filter((s) => s.exerciseId === e.id).map((s) => ({ position: s.position, weightKg: s.weightKg, reps: s.reps, done: s.done }));
    const best = bestSet(sets);
    return {
      position: e.position, exerciseKey: e.exerciseKey, name: e.name, sets, best,
      pr: best !== null && isPr(bests.get(e.exerciseKey) ?? null, { ...best, done: true }),
    };
  });
  return {
    ...toListItem(r), notes: w.notes, kcalBasis: w.kcalBasis, exercises, prCount: exercises.filter((e) => e.pr).length,
    createdAt: w.createdAt.toISOString(), updatedAt: w.updatedAt.toISOString(),
  };
}

/** The "Previous" values for a new session: each key's sets from the latest visible workout that had it. */
export async function previousSetsFor(userId: string, keys: string[]): Promise<PreviousSets> {
  const unique = [...new Set(keys)].slice(0, 30);
  if (!unique.length) return {};
  const latest = await db.selectDistinctOn([workoutExercise.exerciseKey], { id: workoutExercise.id, key: workoutExercise.exerciseKey })
    .from(workoutExercise).innerJoin(workout, eq(workoutExercise.workoutId, workout.id))
    .where(and(visibleWorkoutWhere(userId), inArray(workoutExercise.exerciseKey, unique)))
    .orderBy(workoutExercise.exerciseKey, desc(workout.date), desc(workout.startedAt), desc(workout.createdAt), asc(workoutExercise.position));
  const out: PreviousSets = {};
  if (!latest.length) return out;
  const sets = await db.select().from(workoutSet).where(inArray(workoutSet.exerciseId, latest.map((l) => l.id))).orderBy(asc(workoutSet.position));
  for (const l of latest) {
    out[l.key] = sets.filter((s) => s.exerciseId === l.id).map((s) => ({ position: s.position, weightKg: s.weightKg, reps: s.reps, done: s.done }));
  }
  return out;
}

export const SummaryQuerySchema = z.object({ week: PlainDateSchema.optional() });

/**
 * GET /api/v1/fitness/summary: the Monday–Sunday week containing `week` (default today, both in the
 * user's timezone), goal progress in days trained, up next, and the five latest workouts.
 */
export async function getFitnessSummary(userId: string, raw: z.input<typeof SummaryQuerySchema> = {}, now: Date = new Date()): Promise<FitnessSummary> {
  const q = SummaryQuerySchema.parse(raw);
  const prof = await getProfile(userId);
  const today = todayIn(prof.timezone, now);
  const { start, end } = weekBounds(q.week ?? today);
  const [inWeek, recent, [lastGym]] = await Promise.all([
    queryList(userId, { from: start, to: end }),
    queryList(userId, { limit: 5 }),
    db.select({ preset: workout.preset }).from(workout)
      .where(and(visibleWorkoutWhere(userId), eq(workout.kind, "gym"), isNotNull(workout.preset)))
      .orderBy(desc(workout.date), desc(workout.startedAt), desc(workout.createdAt)).limit(1),
  ]);
  const next: Preset = upNext(lastGym?.preset ?? null);
  return {
    today,
    week: weekSummary(inWeek, start, today, prof.weeklyWorkoutGoal),
    upNext: { preset: next, title: PRESETS[next].title, muscles: PRESETS[next].muscles, exerciseCount: PRESETS[next].exercises.length },
    recent,
  };
}

export const FitnessSettingsSchema = z.object({
  weeklyWorkoutGoal: z.number().int().min(1).max(7).optional(),
  goalWeightKg: z.number().min(20).max(400).nullable().optional(),
});

/** PATCH /api/v1/me/fitness: the weekly goal (days, 1–7) and the goal weight (null clears it). */
export async function updateFitnessSettings(userId: string, raw: z.input<typeof FitnessSettingsSchema>): Promise<FitnessSettings> {
  const input = FitnessSettingsSchema.parse(raw);
  const set: Partial<typeof profile.$inferInsert> = {};
  if (input.weeklyWorkoutGoal !== undefined) set.weeklyWorkoutGoal = input.weeklyWorkoutGoal;
  if (input.goalWeightKg !== undefined) set.goalWeightKg = input.goalWeightKg === null ? null : round2(input.goalWeightKg);
  await getProfile(userId);
  if (Object.keys(set).length) await db.update(profile).set({ ...set, updatedAt: new Date() }).where(eq(profile.userId, userId));
  const prof = await getProfile(userId);
  return { weeklyWorkoutGoal: prof.weeklyWorkoutGoal, goalWeightKg: prof.goalWeightKg };
}

