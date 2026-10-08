// Fitness tracker types (spec §C): the shared vocabulary and every API response shape. Type-only and
// dependency-free, so client components can import from here without pulling in the database.

export const PRESET_KEYS = ["push", "pull", "legs", "back", "shoulders"] as const;
export type Preset = (typeof PRESET_KEYS)[number];
export const ACTIVITY_KEYS = ["walk", "run", "cycling", "yoga", "sport"] as const;
export type Activity = (typeof ACTIVITY_KEYS)[number];
export const INTENSITIES = ["easy", "moderate", "hard"] as const;
export type Intensity = (typeof INTENSITIES)[number];
export const WORKOUT_KINDS = ["gym", "activity"] as const;
export type WorkoutKind = (typeof WORKOUT_KINDS)[number];
/** What sets the MET: a gym session, or one of the activities. */
export type BurnKind = "gym" | Activity;

/** The inputs a workout's kcal_burned was computed from (stored as workout.kcal_basis). */
export type KcalBasis = { met: number; weightKg: number; estimated: boolean; minutes: number };

/** One set as the stats functions see it. */
export type SetLike = { weightKg: number | null; reps: number | null; done: boolean };

export type WorkoutSet = SetLike & { position: number };

/** The best done set of an exercise, by Epley e1RM. */
export type BestSet = { weightKg: number; reps: number; e1rm: number };

export type WorkoutExercise = {
  position: number;
  /** A catalogue key (lib/fitness/catalogue.ts), or `custom:<slug>` for an exercise added by name. */
  exerciseKey: string;
  name: string;
  sets: WorkoutSet[];
  best: BestSet | null;
  /** The best set beats every earlier best for this exercise_key (false when there is no earlier one). */
  pr: boolean;
};

/** A workout in a list (GET /api/v1/workouts, the summary's recent five). */
export type WorkoutListItem = {
  id: string;
  date: string; // YYYY-MM-DD, the user's local day
  kind: WorkoutKind;
  preset: Preset | null;
  activity: Activity | null;
  title: string;
  intensity: Intensity;
  startedAt: string; // ISO timestamp
  durationMin: number;
  kcalBurned: number;
  /** No body weight was logged on or before the date, so 70 kg was assumed: show "~". */
  kcalEstimated: boolean;
  exerciseCount: number;
  /** Sets marked done. */
  setCount: number;
  /** Σ weight × reps over done sets, kg. */
  volumeKg: number;
};

/** GET /api/v1/workouts/{id}, and the body of POST and PATCH responses. */
export type WorkoutDetail = WorkoutListItem & {
  notes: string | null;
  kcalBasis: KcalBasis;
  exercises: WorkoutExercise[];
  /** How many exercises set a PR. */
  prCount: number;
  createdAt: string;
  updatedAt: string;
};

export type DayState = "done" | "rest" | "today" | "future";
export type WeekDay = {
  date: string;
  /** "M", "T", "W", … */
  label: string;
  sessions: number;
  trained: boolean;
  isToday: boolean;
  /** done = trained; otherwise today, future, or rest (a past day with no workout). */
  state: DayState;
};

export type WeekSummary = {
  start: string; // Monday
  end: string; // Sunday
  days: WeekDay[];
  sessions: number;
  minutes: number;
  kcal: number;
  /** Any of this week's kcal figures used the 70 kg estimate. */
  kcalEstimated: boolean;
  /** Progress toward profile.weekly_workout_goal, counted in days trained. */
  goal: { target: number; done: number; met: boolean };
};

export type UpNext = { preset: Preset; title: string; muscles: string; exerciseCount: number };

/** GET /api/v1/fitness/summary?week=YYYY-MM-DD */
export type FitnessSummary = {
  today: string;
  week: WeekSummary;
  upNext: UpNext;
  /** The five latest workouts, any week. */
  recent: WorkoutListItem[];
};

export type WeightEntry = { date: string; kg: number };

/** GET /api/v1/weight */
export type WeightHistory = {
  /** Newest first. */
  entries: WeightEntry[];
  latest: WeightEntry | null;
  /** Latest minus the first entry of the 30 days ending at the latest one; null with fewer than two. */
  change30d: number | null;
  goalWeightKg: number | null;
};

/** GET /api/v1/workouts/previous?keys=a,b → each key's sets from the last workout that had it. */
export type PreviousSets = Record<string, WorkoutSet[]>;

/** GET /api/v1/workouts/history?cursor= → a page of workouts, newest first. */
export type HistoryPage = { items: WorkoutListItem[]; nextCursor: string | null };

/** PATCH /api/v1/me/fitness, and the return of POST /api/v1/me/fitness/setup. */
export type FitnessSettings = { weeklyWorkoutGoal: number; goalWeightKg: number | null; heightCm: number | null };
