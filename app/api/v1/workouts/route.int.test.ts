import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUser, resetDb } from "@/tests/helpers/db";
import { todayIn } from "@/lib/dates";
import type { FitnessSettings, FitnessSummary, PreviousSets, WeightEntry, WeightHistory, WorkoutDetail, WorkoutListItem } from "@/lib/fitness/types";

const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/lib/session", async () => {
  const { unauthorized } = await import("@/lib/http");
  return { requireApiUser: async () => session.userId ?? unauthorized() };
});

const workouts = await import("./route");
const one = await import("./[id]/route");
const previous = await import("./previous/route");
const summary = await import("../fitness/summary/route");
const weight = await import("../weight/route");
const weightDate = await import("../weight/[date]/route");
const meFitness = await import("../me/fitness/route");

const url = (path: string) => `http://localhost/api/v1/${path}`;
const send = (path: string, method: string, body?: unknown) =>
  new Request(url(path), { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const ctx = <K extends string>(key: K, value: string) => ({ params: Promise.resolve({ [key]: value } as Record<K, string>) });
const today = () => todayIn("Asia/Kolkata");

const pushDay = () => ({
  kind: "gym", date: today(), preset: "push", durationMin: 48,
  exercises: [{ exerciseKey: "bench_press", sets: [{ weightKg: 60, reps: 8, done: true }, { weightKg: 60, reps: 8, done: true }] }],
});

describe("fitness API", () => {
  beforeEach(async () => {
    await resetDb();
    session.userId = null;
  });

  it("needs a session everywhere", async () => {
    const statuses = await Promise.all([
      workouts.GET(new Request(url("workouts"))), workouts.POST(send("workouts", "POST", pushDay())),
      one.GET(new Request(url("workouts/x")), ctx("id", "x")), one.PATCH(send("workouts/x", "PATCH", {}), ctx("id", "x")), one.DELETE(send("workouts/x", "DELETE"), ctx("id", "x")),
      previous.GET(new Request(url("workouts/previous?keys=squat"))), summary.GET(new Request(url("fitness/summary"))),
      weight.GET(new Request(url("weight"))), weight.POST(send("weight", "POST", { date: today(), kg: 70 })),
      weightDate.DELETE(send(`weight/${today()}`, "DELETE"), ctx("date", today())), meFitness.PATCH(send("me/fitness", "PATCH", {})),
    ]);
    expect(statuses.map((r) => r.status)).toEqual(Array(11).fill(401));
  });

  it("creates, lists, reads, patches and deletes a workout; other users get 404", async () => {
    const me = (session.userId = await createUser());
    const res = await workouts.POST(send("workouts", "POST", { ...pushDay(), kcalBurned: 9999 }));
    expect(res.status).toBe(201);
    const { workout: created } = (await res.json()) as { workout: WorkoutDetail };
    expect(created).toMatchObject({ title: "Push", kcalBurned: 280, kcalEstimated: true, volumeKg: 960, setCount: 2 }); // client kcal ignored

    const list = (await (await workouts.GET(new Request(url("workouts")))).json()) as { workouts: WorkoutListItem[] };
    expect(list.workouts.map((w) => w.id)).toEqual([created.id]);
    const got = (await (await one.GET(new Request(url(`workouts/${created.id}`)), ctx("id", created.id))).json()) as { workout: WorkoutDetail };
    expect(got.workout.exercises[0]).toMatchObject({ exerciseKey: "bench_press", name: "Bench press", pr: false });

    const patched = await one.PATCH(send(`workouts/${created.id}`, "PATCH", { durationMin: 60, intensity: "hard" }), ctx("id", created.id));
    expect(patched.status).toBe(200);
    expect(((await patched.json()) as { workout: WorkoutDetail }).workout.kcalBurned).toBe(420); // 6.0 × 70 × 1 h

    session.userId = await createUser();
    expect((await one.GET(new Request(url(`workouts/${created.id}`)), ctx("id", created.id))).status).toBe(404);
    expect((await one.PATCH(send(`workouts/${created.id}`, "PATCH", { title: "x" }), ctx("id", created.id))).status).toBe(404);
    expect((await one.DELETE(send(`workouts/${created.id}`, "DELETE"), ctx("id", created.id))).status).toBe(404);
    expect(((await (await workouts.GET(new Request(url("workouts")))).json()) as { workouts: unknown[] }).workouts).toEqual([]);

    session.userId = me;
    expect((await one.DELETE(send(`workouts/${created.id}`, "DELETE"), ctx("id", created.id))).status).toBe(204);
    expect((await one.GET(new Request(url(`workouts/${created.id}`)), ctx("id", created.id))).status).toBe(404);
  });

  it("answers 400 for invalid input", async () => {
    session.userId = await createUser();
    expect((await workouts.POST(send("workouts", "POST", { kind: "swim", date: today() }))).status).toBe(400);
    expect((await workouts.POST(send("workouts", "POST", { ...pushDay(), exercises: [{ exerciseKey: "made_up", sets: [] }] }))).status).toBe(400);
    expect((await workouts.GET(new Request(url("workouts?from=yesterday")))).status).toBe(400);
    expect((await workouts.GET(new Request(url("workouts?from=2026-10-05&to=2026-10-01")))).status).toBe(400);
    expect((await previous.GET(new Request(url("workouts/previous")))).status).toBe(400);
    expect((await summary.GET(new Request(url("fitness/summary?week=soon")))).status).toBe(400);
    expect((await weight.POST(send("weight", "POST", { date: today(), kg: 1000 }))).status).toBe(400);
    expect((await meFitness.PATCH(send("me/fitness", "PATCH", { weeklyWorkoutGoal: 9 }))).status).toBe(400);
  });

  it("serves previous sets, the summary, weight and fitness settings", async () => {
    session.userId = await createUser();
    await workouts.POST(send("workouts", "POST", pushDay()));
    const prev = (await (await previous.GET(new Request(url("workouts/previous?keys=bench_press,squat")))).json()) as { previous: PreviousSets };
    expect(Object.keys(prev.previous)).toEqual(["bench_press"]);

    const s = (await (await summary.GET(new Request(url("fitness/summary")))).json()) as FitnessSummary;
    expect(s.today).toBe(today());
    expect(s.week.sessions).toBe(1);
    expect(s.upNext.preset).toBe("pull");
    expect(s.recent).toHaveLength(1);

    const logged = await weight.POST(send("weight", "POST", { date: today(), kg: 71.5 }));
    expect(logged.status).toBe(201);
    expect(((await logged.json()) as { entry: WeightEntry }).entry).toEqual({ date: today(), kg: 71.5 });
    await weight.POST(send("weight", "POST", { date: today(), kg: 71.2 }));
    const h = (await (await weight.GET(new Request(url("weight")))).json()) as WeightHistory;
    expect(h.entries).toEqual([{ date: today(), kg: 71.2 }]);
    expect((await weightDate.DELETE(send(`weight/${today()}`, "DELETE"), ctx("date", today()))).status).toBe(204);
    expect((await weightDate.DELETE(send(`weight/${today()}`, "DELETE"), ctx("date", today()))).status).toBe(404);

    const f = await meFitness.PATCH(send("me/fitness", "PATCH", { weeklyWorkoutGoal: 5, goalWeightKg: 68 }));
    expect(((await f.json()) as { fitness: FitnessSettings }).fitness).toEqual({ weeklyWorkoutGoal: 5, goalWeightKg: 68 });
    expect(((await (await summary.GET(new Request(url("fitness/summary")))).json()) as FitnessSummary).week.goal.target).toBe(5);
  });
});
