// Dev-only demo account (pnpm seed:demo): an onboarded user "Aarav Kapoor" with a real Better Auth
// session, 10 days of diary and 4 scans, so headless screenshots (pnpm shot) can reach signed-in
// screens — the app itself only has Google sign-in. Idempotent: every run refreshes the user and
// profile, replaces the session, diary and scans, and rebuilds this period's credit ledger.
// Refuses to run in production or against a database that isn't on localhost.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { makeSignature } from "better-auth/crypto";
import { auth } from "@/lib/auth";
import { refundScan, debitForScan, getBalance } from "@/lib/credits/ledger";
import { addDays, todayIn } from "@/lib/dates";
import { db } from "@/lib/db/client";
import { session, user } from "@/lib/db/auth-schema";
import { creditTxn, food, foodLog, profile, scan, userFoodStats } from "@/lib/db/schema";
import { ENGINE_VERSION } from "@/lib/engine";
import { buildResult, type ScanResult } from "@/lib/engine/result";
import { searchFoodRows, type FoodRow } from "@/lib/foods/service";
import { addEntry, getDay, type AddEntryInput } from "@/lib/log/service";
import { dishScore } from "@/lib/nutrition/grade/dish";
import { ensureBasePortion, scaleNutrients } from "@/lib/nutrition/portions";
import { targetsFor } from "@/lib/nutrition/targets";
import { assertLocalDb } from "./lib/local-guard";
import type { Meal, NutrientKey, Nutrients, Provenance } from "@/lib/nutrition/types";

const EMAIL = "demo@eatri8.local";
const NAME = "Aarav Kapoor";
const TZ = "Asia/Kolkata";
const COOKIE_FILE = resolve(".superpowers/demo-cookie.txt");
const SESSION_DAYS = 30;
const DEMO_TARGETS = { protein: 75 };
const PROFILE = { timezone: TZ, goal: "weight_loss", diet: "vegetarian", allergies: ["peanut"], country: "IN" } as const;

const guard = () => assertLocalDb("seed:demo");

// --- user, profile, session -------------------------------------------------------------------------

async function upsertUser(): Promise<string> {
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, EMAIL));
  const id = existing?.id ?? `demo_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const now = new Date();
  if (existing) await db.update(user).set({ name: NAME, emailVerified: true, updatedAt: now }).where(eq(user.id, id));
  else await db.insert(user).values({ id, name: NAME, email: EMAIL, emailVerified: true, createdAt: now, updatedAt: now });
  // One custom target, set "before Pro": with PRO_GATES_ENFORCED on it's ignored (the goal's preset applies)
  // and the one-time targets-reset notice shows, so ui:audit can cover it. notices reset so it shows again.
  const p = { ...PROFILE, allergies: [...PROFILE.allergies], targets: DEMO_TARGETS, notices: {}, onboardedAt: now, plan: "basic" as const, updatedAt: now };
  await db.insert(profile).values({ userId: id, ...p }).onConflictDoUpdate({ target: profile.userId, set: p });
  return id;
}

/**
 * A session row made by Better Auth's own internal adapter, and the cookie header a browser sends
 * for it. Better Auth sets `session_token` through better-call's `setSignedCookie`, whose
 * `signCookieValue` (better-call/dist/crypto.mjs) is `encodeURIComponent(`${token}.${makeSignature(token, secret)}`)`;
 * `makeSignature` is the same HMAC-SHA256 helper better-auth exports from `better-auth/crypto`.
 * The cookie name (prefix, `__Secure-` on https) and the secret come from the auth context itself.
 */
async function mintSession(userId: string): Promise<string> {
  await db.delete(session).where(eq(session.userId, userId));
  const ctx = await auth.$context;
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const s = await ctx.internalAdapter.createSession(userId, false, { expiresAt, userAgent: "seed-demo" }, true);
  if (!s) throw new Error("Better Auth did not create a session.");
  const value = encodeURIComponent(`${s.token}.${await makeSignature(s.token, ctx.secret)}`);
  return `${ctx.authCookies.sessionToken.name}=${value}`;
}

// --- diary ------------------------------------------------------------------------------------------

type Pick = { q: string[]; ok?: (f: FoodRow) => boolean };
const notOff = (f: FoodRow) => f.source !== "off";
// The food each diary key resolves to, through the app's own search (first query with an acceptable hit).
const PICKS: Record<string, Pick> = {
  poha: { q: ["poha"], ok: notOff },
  chai: { q: ["masala chai", "chai"], ok: (f) => notOff(f) && /tea|chai/i.test(f.name) && f.per100.energyKcal < 120 },
  dal: { q: ["dal tadka", "dal"], ok: notOff },
  roti: { q: ["roti"], ok: notOff },
  // The catalogue has no jeera rice: fall back to plain boiled rice.
  rice: { q: ["jeera rice", "chawal", "rice"], ok: (f) => notOff(f) && /rice/i.test(f.name) && /boiled|cooked|jeera/i.test(f.name) },
  rajma: { q: ["rajma"], ok: notOff },
  paneer: { q: ["paneer"], ok: (f) => notOff(f) && /curry|palak|butter/i.test(f.name) },
  curd: { q: ["curd"], ok: (f) => /^(curd|yogurt)/i.test(f.name) && f.per100.energyKcal < 120 },
  banana: { q: ["banana"], ok: (f) => notOff(f) && /^banana/i.test(f.name) && f.per100.energyKcal < 120 },
  idli: { q: ["idli"], ok: notOff },
  sambar: { q: ["sambar"], ok: notOff },
  samosa: { q: ["samosa"], ok: notOff },
  bhujia: { q: ["aloo bhujia", "bhujia"], ok: (f) => f.source === "off" && f.kind === "packaged" && f.per100.sodiumMg !== undefined },
};

async function resolveFoods(userId: string): Promise<Record<string, FoodRow>> {
  const out: Record<string, FoodRow> = {};
  for (const [key, pick] of Object.entries(PICKS)) {
    for (const q of pick.q) {
      const hit = (await searchFoodRows(userId, q, "IN", 30)).find((f) => (pick.ok ?? (() => true))(f) && f.portions.some((p) => p.grams));
      if (hit) { out[key] = hit; break; }
    }
    if (!out[key]) throw new Error(`No catalogue food for "${key}" (searched ${pick.q.join(", ")}). Run pnpm seed:foods first.`);
  }
  // A long but realistic OFF product name (40–80 chars, no label boilerplate), to exercise truncation.
  const [long] = await db.select().from(food)
    .where(and(eq(food.source, "off"), sql`${food.deletedAt} IS NULL`, sql`length(${food.name}) BETWEEN 40 AND 80`, sql`${food.name} !~* '(www\\.|bpom|kode|trademark|reg\\.)'`, sql`${food.name} ~ '^[ -~]+$'`, sql`${food.ownerId} IS NULL`))
    .orderBy(sql`length(${food.name}) DESC`, food.id).limit(1);
  if (!long) throw new Error("No OFF food with a name of 40+ characters. Run pnpm seed:foods first.");
  out.long = long;
  return out;
}

// [food key, portion label regex or grams, quantity]
type Item = [key: string, portion: RegExp | number, qty?: number];
type DayPlan = Partial<Record<Meal, Item[]>>;

const BF_IDLI: Item[] = [["idli", /idli/, 3], ["sambar", /katori/], ["chai", /tea cup|cup/]];
const BF_POHA: Item[] = [["poha", 150], ["chai", /tea cup|cup/]];
const LUNCH_DAL: Item[] = [["roti", /^1 roti/, 2], ["dal", 150], ["rice", 100], ["curd", 100]];
const LUNCH_RAJMA: Item[] = [["rajma", /katori/], ["rice", 150], ["curd", 100]];
const SNACK: Item[] = [["banana", /^1 banana/], ["chai", /tea cup|cup/]];
const DINNER_PANEER: Item[] = [["roti", /^1 roti/, 2], ["paneer", /katori|bowl/]];
const DINNER_DAL: Item[] = [["roti", /^1 roti/, 2], ["dal", 150]];

// Index 0 is today (IST), 1 yesterday, ... 9. Two days over the calorie target, one high in sodium,
// one empty (breaks the streak); today has breakfast and lunch only.
const PLAN: DayPlan[] = [
  { breakfast: [...BF_POHA, ["long", 30]], lunch: LUNCH_DAL },
  { breakfast: BF_IDLI, lunch: LUNCH_RAJMA, snack: SNACK, dinner: DINNER_PANEER },
  { breakfast: BF_POHA, lunch: [...LUNCH_DAL, ["samosa", /regular|large/, 2]], snack: [["bhujia", 60], ["chai", /tea cup|cup/]], dinner: [["roti", /^1 roti/, 3], ["paneer", /katori|bowl/]] },
  { breakfast: [["chai", /tea cup|cup/]], lunch: [["rajma", /katori/], ["rice", 150]], snack: [["bhujia", 80], ["samosa", /regular|large/]], dinner: [["dal", 150], ["sambar", /katori/]] },
  {},
  { breakfast: BF_IDLI, lunch: LUNCH_DAL, snack: SNACK, dinner: DINNER_PANEER },
  { breakfast: [...BF_POHA, ["banana", /^1 banana/]], lunch: [...LUNCH_RAJMA, ["roti", /^1 roti/, 2]], snack: [["samosa", /regular|large/, 2], ["chai", /tea cup|cup/]], dinner: [...DINNER_PANEER, ["rice", 150]] },
  { breakfast: BF_POHA, lunch: LUNCH_RAJMA, snack: SNACK, dinner: DINNER_DAL },
  { breakfast: BF_IDLI, lunch: LUNCH_DAL, dinner: DINNER_PANEER },
  { breakfast: BF_POHA, lunch: LUNCH_DAL, snack: SNACK, dinner: DINNER_DAL },
];

async function clearDiary(userId: string) {
  // addEntry bumps global food.popularity: give back this user's contribution so re-runs don't drift search ranking.
  await db.execute(sql`UPDATE food SET popularity = GREATEST(0, food.popularity - s.uses)
    FROM user_food_stats s WHERE s.food_id = food.id AND s.user_id = ${userId}`);
  await db.delete(userFoodStats).where(eq(userFoodStats.userId, userId));
  await db.delete(foodLog).where(eq(foodLog.userId, userId));
}

function entryFor(f: FoodRow, portion: RegExp | number, qty: number, date: string, meal: Meal): AddEntryInput {
  if (typeof portion === "number") return { kind: "grams", date, meal, foodId: f.id, grams: portion };
  const i = f.portions.findIndex((p) => p.grams && portion.test(p.label));
  if (i < 0) return { kind: "food", date, meal, foodId: f.id, portionIndex: Math.max(0, f.portions.findIndex((p) => p.grams)), quantity: qty };
  return { kind: "food", date, meal, foodId: f.id, portionIndex: i, quantity: qty };
}

async function seedDiary(userId: string, foods: Record<string, FoodRow>, today: string) {
  await clearDiary(userId);
  for (let back = PLAN.length - 1; back >= 0; back--) {
    const date = addDays(today, -back);
    for (const [meal, items] of Object.entries(PLAN[back]!) as [Meal, Item[]][]) {
      for (const [key, portion, qty = 1] of items) await addEntry(userId, entryFor(foods[key]!, portion, qty, date, meal));
    }
  }
}

// --- scans ------------------------------------------------------------------------------------------

const provenanceOf = (n: Nutrients, p: Provenance) =>
  Object.fromEntries(Object.entries(n).filter(([, v]) => v !== undefined).map(([k]) => [k as NutrientKey, p])) as Partial<Record<NutrientKey, Provenance>>;

function scanResults(): { peanuts: ScanResult; milk: ScanResult; thali: ScanResult } {
  const profileArg = { allergies: [...PROFILE.allergies], diet: PROFILE.diet, goal: PROFILE.goal, targets: targetsFor(PROFILE.goal) };
  const peanutsPer100: Nutrients = { energyKcal: 541, protein: 21.4, carbs: 31.6, sugars: 3.8, fat: 36.9, satFat: 5.2, fibre: 6.1, sodiumMg: 560 };
  const peanuts = buildResult({
    name: "Masala Peanuts", brand: "Haldiram's", foodId: null, kind: "packaged", inputKind: "label", basis: "per_100g",
    per100: peanutsPer100, provenance: provenanceOf(peanutsPer100, "label"),
    portions: ensureBasePortion("per_100g", [{ label: "1 serving", amount: 1, unit: "serving", grams: 30 }, { label: "1 pack", amount: 1, unit: "pack", grams: 200 }]),
    defaultPortion: 0, gradeCategory: "general", gradePortionGrams: null,
    ingredients: ["Peanuts (62%)", "Gram flour (besan)", "Edible vegetable oil (palmolein)", "Rice flour", "Salt", "Red chilli powder", "Spices and condiments", "Black salt", "Acidity regulator (INS 330)"],
    allergens: ["peanut"], mayContain: ["tree_nut", "milk"], additives: ["en:e330"], nova: null,
    alternatives: [], hints: [], confidence: "high", profile: profileArg,
  });
  const milkPer100: Nutrients = { energyKcal: 58, protein: 3.1, carbs: 4.7, sugars: 4.7, fat: 3.0, satFat: 2.0, sodiumMg: 44 };
  const milk = buildResult({
    name: "Amul Taaza Milk", brand: "Amul", foodId: null, kind: "packaged", inputKind: "barcode", basis: "per_100ml",
    per100: milkPer100, provenance: provenanceOf(milkPer100, "label"),
    portions: ensureBasePortion("per_100ml", [{ label: "1 glass", amount: 1, unit: "household", grams: 200 }, { label: "1 pouch", amount: 1, unit: "pack", grams: 500 }]),
    defaultPortion: 0, gradeCategory: "general", gradePortionGrams: null,
    ingredients: ["Toned milk"], allergens: ["en:milk"], mayContain: [], additives: [], nova: 1,
    alternatives: [], hints: [], confidence: "high", profile: profileArg,
  });
  const items = [
    { name: "Dal tadka", grams: 150, nutrients: { energyKcal: 165, protein: 8.4, carbs: 19.5, fat: 6.2, fibre: 4.5, sodiumMg: 480 }, provenance: "estimate" as const },
    { name: "Jeera rice", grams: 180, nutrients: { energyKcal: 270, protein: 4.9, carbs: 50.8, fat: 5.0, fibre: 0.9, sodiumMg: 210 }, provenance: "estimate" as const },
    { name: "Roti", grams: 80, nutrients: { energyKcal: 238, protein: 7.8, carbs: 40.0, fat: 4.9, fibre: 7.2, sodiumMg: 300 }, provenance: "estimate" as const },
    { name: "Paneer butter masala", grams: 120, nutrients: { energyKcal: 276, protein: 10.1, carbs: 9.4, fat: 22.3, fibre: 1.6, sodiumMg: 520 }, provenance: "estimate" as const },
    { name: "Curd", grams: 100, nutrients: { energyKcal: 62, protein: 3.5, carbs: 4.7, fat: 3.1, fibre: 0, sodiumMg: 45 }, provenance: "estimate" as const },
  ];
  const total = items.reduce<Nutrients>((s, it) => ({
    energyKcal: s.energyKcal + it.nutrients.energyKcal, protein: s.protein + it.nutrients.protein, carbs: s.carbs + it.nutrients.carbs,
    fat: s.fat + it.nutrients.fat, fibre: (s.fibre ?? 0) + it.nutrients.fibre, sodiumMg: (s.sodiumMg ?? 0) + it.nutrients.sodiumMg,
  }), { energyKcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, sodiumMg: 0 });
  const grams = items.reduce((s, it) => s + it.grams, 0);
  const thaliPer100 = scaleNutrients(total, 100 / grams);
  const thali = buildResult({
    name: "Thali", brand: null, foodId: null, kind: "meal", inputKind: "meal", basis: "per_100g",
    per100: thaliPer100, provenance: provenanceOf(thaliPer100, "estimate"),
    portions: ensureBasePortion("per_100g", [{ label: "This meal", amount: 1, unit: "serving", grams }]),
    defaultPortion: 0, gradeCategory: "dish", gradePortionGrams: grams,
    ingredients: [], allergens: [], mayContain: [], additives: [], nova: null, items,
    alternatives: [], hints: [], confidence: "low", profile: profileArg, precomputedGrade: dishScore(total, thaliPer100),
  });
  return { peanuts, milk, thali };
}

async function seedScans(userId: string) {
  // Cascades/sets null on food_log.scan_id; the ledger is rebuilt from scratch for the current period.
  await db.delete(creditTxn).where(eq(creditTxn.userId, userId));
  await db.delete(scan).where(eq(scan.userId, userId));
  await db.update(profile).set({ credits: 0, allowancePeriod: null, carriedDay: null, carriedDayScans: 0 }).where(eq(profile.userId, userId));

  const r = scanResults();
  const ago = (min: number) => new Date(Date.now() - min * 60_000);
  const ai = { engineVersion: ENGINE_VERSION, modelId: "gemini-3.5-flash-lite", tokensIn: 1200, tokensOut: 300, costMicros: 1110 };
  const done = (result: ScanResult, createdMin: number) => ({
    status: "done" as const, inputKind: result.inputKind, result, confidence: result.confidence, foodId: result.foodId,
    createdAt: ago(createdMin), startedAt: ago(createdMin), doneAt: ago(createdMin - 0.2),
  });

  return db.transaction(async (tx) => {
    const ins = async (v: Omit<typeof scan.$inferInsert, "userId">) => (await tx.insert(scan).values({ userId, ...v }).returning({ id: scan.id }))[0]!.id;
    const thali = await ins({ ...done(r.thali, 60 * 26), ...ai, modelId: "gemini-3.5-flash", imageCount: 1 });
    await debitForScan(tx, userId, thali);
    const failed = await ins({ status: "failed", inputKind: "meal", imageCount: 1, ...ai, errorCode: "UNREADABLE_IMAGE",
      createdAt: ago(60 * 5), startedAt: ago(60 * 5), doneAt: ago(60 * 5 - 0.2) });
    await debitForScan(tx, userId, failed);
    await refundScan(tx, userId, failed);
    const milk = await ins({ ...done(r.milk, 90), engineVersion: ENGINE_VERSION, barcode: "8901262010016", charged: false });
    const peanuts = await ins({ ...done(r.peanuts, 20), ...ai, imageCount: 2 });
    await debitForScan(tx, userId, peanuts);

    // The ledger rows were all written now, in this one transaction. Backdate each to its scan (the
    // grant just before the first one, the refund when the failed scan finished) so the credits chart
    // and activity day groups show real history. Never before this period's start (the 1st, UTC).
    const periodStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
    const at = (d: Date) => new Date(Math.max(d.getTime(), periodStart.getTime()));
    const thaliAt = ago(60 * 26);
    await tx.update(creditTxn).set({ createdAt: at(new Date(thaliAt.getTime() - 60_000)) }).where(and(eq(creditTxn.userId, userId), eq(creditTxn.type, "grant")));
    for (const [scanId, debitAt, refundAt] of [
      [thali, thaliAt, null],
      [failed, ago(60 * 5), ago(60 * 5 - 0.2)],
      [peanuts, ago(20), null],
    ] as const) {
      await tx.update(creditTxn).set({ createdAt: at(debitAt) }).where(and(eq(creditTxn.scanId, scanId), eq(creditTxn.type, "debit")));
      if (refundAt) await tx.update(creditTxn).set({ createdAt: at(refundAt) }).where(and(eq(creditTxn.scanId, scanId), eq(creditTxn.type, "refund")));
    }
    return { peanuts, milk, thali, failed, grades: { peanuts: r.peanuts.grade, milk: r.milk.grade, thali: r.thali.grade } };
  });
}

// --- verify -----------------------------------------------------------------------------------------

async function verify(cookie: string): Promise<string> {
  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${base}/api/v1/me`, { headers: { cookie }, signal: AbortSignal.timeout(15_000) });
    // /api/v1/me returns the caller's profile (no email): 200 with the demo profile means the cookie signed in.
    const body = (await res.json().catch(() => null)) as { profile?: { diet?: string; allergies?: string[]; credits?: number } } | null;
    const p = body?.profile;
    return res.ok && p?.diet === PROFILE.diet && p.allergies?.includes("peanut")
      ? `Verified    GET ${base}/api/v1/me → ${res.status} (demo profile: ${p.diet}, credits ${p.credits})`
      : `NOT VERIFIED: GET ${base}/api/v1/me → ${res.status}`;
  } catch {
    return `Dev server not reachable at ${base}. To verify: start pnpm dev, then\n  curl -s -H "cookie: $(cat .superpowers/demo-cookie.txt)" ${base}/api/v1/me`;
  }
}

async function main() {
  guard();
  const userId = await upsertUser();
  const cookie = await mintSession(userId);
  mkdirSync(dirname(COOKIE_FILE), { recursive: true });
  writeFileSync(COOKIE_FILE, `${cookie}\n`, { mode: 0o600 });

  const today = todayIn(TZ);
  const foods = await resolveFoods(userId);
  await seedDiary(userId, foods, today);
  const scans = await seedScans(userId);

  console.log(`Demo user   ${userId} (${EMAIL})`);
  console.log(`Cookie file ${COOKIE_FILE} (valid ${SESSION_DAYS} days)`);
  console.log(`Foods       ${Object.entries(foods).map(([k, f]) => `${k}="${f.name}"`).join(", ")}`);
  for (let back = PLAN.length - 1; back >= 0; back--) {
    const d = await getDay(userId, addDays(today, -back));
    const kcal = d.progress.find((p) => p.key === "energyKcal")!, na = d.progress.find((p) => p.key === "sodiumMgMax")!;
    console.log(`  ${d.date}  ${String(d.entries.length).padStart(2)} entries  ${Math.round(kcal.total)}/${kcal.target} kcal  sodium ${Math.round(na.total)}/${na.target} mg`);
  }
  console.log(`Scans       label ${scans.peanuts} (${scans.grades.peanuts}), barcode ${scans.milk} (${scans.grades.milk}), meal ${scans.thali} (${scans.grades.thali}), failed ${scans.failed}`);
  const bal = await getBalance(userId);
  const txns = await db.select({ type: creditTxn.type, amount: creditTxn.amount }).from(creditTxn).where(eq(creditTxn.userId, userId));
  console.log(`Credits     ${bal.credits} of ${bal.allowance} (ledger: ${txns.map((t) => `${t.type} ${t.amount > 0 ? "+" : ""}${t.amount}`).join(", ")})`);
  console.log(await verify(cookie));
}

main().then(() => process.exit(0), (e: unknown) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
