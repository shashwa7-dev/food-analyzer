import { and, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUser, resetDb, testDb } from "@/tests/helpers/db";
import { creditTxn, food, profile, scan } from "@/lib/db/schema";
import { user } from "@/lib/db/auth-schema";
import { getBalance } from "@/lib/credits/ledger";
import { EngineError } from "@/lib/engine/errors";
import type { ExtractOutput } from "@/lib/engine";
import { sanitiseExtraction, type EngineImage, type Extraction } from "@/lib/engine/schema";
import { upsertFood } from "@/lib/foods/insert";
import { PRESETS } from "@/lib/nutrition/targets";
import { toFoodDraft, type SourceRecord } from "@/lib/foods/seed-map";
import labelNamkeenJson from "@/lib/engine/__fixtures__/label-namkeen.json";
import unreadableJson from "@/lib/engine/__fixtures__/unreadable.json";
import frontOnlyJson from "@/lib/engine/__fixtures__/front-only.json";
import perServingJson from "@/lib/engine/__fixtures__/label-per-serving-no-size.json";
import { InvalidError } from "@/lib/errors";
import { createCustomFoodFromScan } from "@/lib/foods/service";
import { addEntry, updateEntry } from "@/lib/log/service";
import { realDeps } from "./deps";
import { NOT_CONFIGURED_MESSAGE, REFUNDED_MESSAGE, SCAN_MESSAGES } from "./messages";
import { completeScan, createScan, deleteScan, getScan, listScans, visibleScanWhere, type CreateScanInput, type ScanDeps, type Schedule } from "./service";

// --- fixtures ---------------------------------------------------------------------------------------

const T0 = Date.parse("2026-10-07T10:00:00Z");
let clock = T0;
const now = () => clock;
const advance = (ms: number) => { clock += ms; };

const IMG: EngineImage = { mime: "image/jpeg", data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) };
const NAMKEEN_CODE = "8901491101837";
const OTHER_CODE = "4006381333931"; // valid EAN-13

const labelNamkeen = sanitiseExtraction(labelNamkeenJson);
const labelNoBarcode: Extraction = (() => {
  const copy: Record<string, unknown> = { ...labelNamkeenJson };
  delete copy.barcodeText;
  return sanitiseExtraction(copy);
})();
const unreadable = sanitiseExtraction(unreadableJson);
const frontOnly = sanitiseExtraction(frontOnlyJson);

const out = (data: Extraction): ExtractOutput => ({ data, usage: { inputTokens: 1200, outputTokens: 300 }, modelId: "gemini-3.5-flash-lite", costMicros: 1110 });
const extracting = (data: Extraction) => vi.fn(async () => out(data));

const offRec = (code: string, per100: SourceRecord["per100"] = { energyKcal: 554, protein: 11, carbs: 51.7, fat: 34, sugars: 2, satFat: 15, sodiumMg: 1050 }): SourceRecord => ({
  source: "off", sourceRef: code, barcode: code, name: "Aloo Bhujia", brand: "Shree Rama", basis: "per_100g", per100, portions: [],
  categories: ["en:snacks"], countries: ["IN"],
});

function deps(userId: string, overrides: Partial<ScanDeps> = {}): ScanDeps {
  return {
    ...realDeps(userId),
    fetchOffByBarcode: vi.fn(async () => null), // never the network
    extract: vi.fn(async () => { throw new Error("extract must not be called"); }),
    config: () => ({ aiEnabled: true, dailyAiScanCap: 300 }),
    now,
    ...overrides,
  };
}

/** Background jobs run when the test says so. */
function jobs() {
  const pending: (() => Promise<void>)[] = [];
  const schedule: Schedule = (fn) => { pending.push(fn); };
  return {
    schedule,
    get count() { return pending.length; },
    async runAll() { while (pending.length) await pending.shift()!(); },
  };
}

const aiInput = (o: Partial<CreateScanInput> = {}): CreateScanInput => ({ images: [IMG], barcode: null, ...o });
const credits = async (u: string) => (await getBalance(u, new Date(clock))).credits;
const txns = (u: string) => testDb().select().from(creditTxn).where(eq(creditTxn.userId, u));
const scansOf = (u: string) => testDb().select().from(scan).where(eq(scan.userId, u));
type Body = { scanId: string; status: string; errorCode: string | null; errorMessage: string | null; result: { name: string; foodId: string | null } | null; error?: { code: string; message: string } };
const body = (r: { body: unknown }) => r.body as Body;

beforeEach(async () => {
  clock = T0;
  await resetDb();
});

// --- barcode path (free) ------------------------------------------------------------------------

describe("barcode scans", () => {
  it("a barcode hit in our DB is free: 200 done, balance unchanged, no debit, no model call", async () => {
    const u = await createUser();
    const cached = await upsertFood(toFoodDraft(offRec(NAMKEEN_CODE), []));
    const d = deps(u);
    const j = jobs();
    const r = await createScan(u, { images: [], barcode: NAMKEEN_CODE }, d, j.schedule);
    expect(r.status).toBe(200);
    expect(body(r)).toMatchObject({ status: "done", errorCode: null, result: { name: "Aloo Bhujia", foodId: cached.id } });
    expect(j.count).toBe(0);
    expect(d.extract).not.toHaveBeenCalled();
    const [s] = await scansOf(u);
    expect(s).toMatchObject({ status: "done", charged: false, inputKind: "barcode", barcode: NAMKEEN_CODE, foodId: cached.id, imageCount: 0, confidence: "high" });
    expect(s!.doneAt).not.toBeNull();
    expect(await credits(u)).toBe(20);
    expect((await txns(u)).filter((t) => t.type === "debit")).toHaveLength(0);
  });

  it("an OFF hit is cached as a food and returned free", async () => {
    const u = await createUser();
    const d = deps(u, { fetchOffByBarcode: vi.fn(async () => offRec(OTHER_CODE)) });
    const r = await createScan(u, { images: [], barcode: OTHER_CODE }, d, jobs().schedule);
    expect(r.status).toBe(200);
    const [cached] = await testDb().select().from(food).where(eq(food.barcode, OTHER_CODE));
    expect(cached!.source).toBe("off");
    expect(body(r).result!.foodId).toBe(cached!.id);
    expect(await credits(u)).toBe(20);
  });

  it("barcode not found and no images: 200 done with BARCODE_NOT_FOUND, free", async () => {
    const u = await createUser();
    const r = await createScan(u, { images: [], barcode: OTHER_CODE }, deps(u), jobs().schedule);
    expect(r.status).toBe(200);
    expect(body(r)).toMatchObject({ status: "done", errorCode: "BARCODE_NOT_FOUND", errorMessage: SCAN_MESSAGES.BARCODE_NOT_FOUND, result: null });
    const [s] = await scansOf(u);
    expect(s).toMatchObject({ status: "done", charged: false, errorCode: "BARCODE_NOT_FOUND", inputKind: "barcode" });
    expect(await credits(u)).toBe(20);
  });

  it("barcode scans still work when the model API key is missing", async () => {
    const u = await createUser();
    await upsertFood(toFoodDraft(offRec(NAMKEEN_CODE), []));
    const r = await createScan(u, { images: [], barcode: NAMKEEN_CODE }, deps(u, { config: () => ({ aiEnabled: false, dailyAiScanCap: 300 }) }), jobs().schedule);
    expect(r.status).toBe(200);
  });
});

// --- AI path (1 credit) --------------------------------------------------------------------------

describe("AI scans", () => {
  it("debits 1 credit at create (202 queued), then completes done with usage, a crowd food and scan.foodId", async () => {
    const u = await createUser();
    const extract = extracting(labelNamkeen);
    const d = deps(u, { extract });
    const j = jobs();
    const deadline = T0 + 50_000;
    const r = await createScan(u, aiInput({ deadline }), d, j.schedule);
    expect(r.status).toBe(202);
    expect(body(r)).toMatchObject({ status: "queued" });
    const id = body(r).scanId;
    expect(await credits(u)).toBe(19);
    let [s] = await scansOf(u);
    expect(s).toMatchObject({ id, status: "queued", charged: true, imageCount: 1 });

    expect(j.count).toBe(1);
    await j.runAll();
    expect(extract).toHaveBeenCalledTimes(1);
    expect((extract.mock.calls[0] as unknown as [EngineImage[], { deadline: number }])[1].deadline).toBe(deadline);

    [s] = await scansOf(u);
    expect(s).toMatchObject({ status: "done", inputKind: "label", confidence: "high", modelId: "gemini-3.5-flash-lite", tokensIn: 1200, tokensOut: 300, costMicros: 1110, charged: true, errorCode: null });
    expect(s!.startedAt).not.toBeNull();
    expect(s!.doneAt).not.toBeNull();
    const [crowd] = await testDb().select().from(food).where(eq(food.barcode, NAMKEEN_CODE));
    expect(crowd).toMatchObject({ source: "crowd", name: "Aloo Bhujia", countries: ["IN"], ownerId: null, imageUrl: null });
    expect(s!.foodId).toBe(crowd!.id);
    expect(s!.result!.foodId).toBe(crowd!.id);

    const view = await getScan(u, id, clock);
    expect(view).toMatchObject({ id, status: "done", errorCode: null, refunded: false });
    expect(view!.result!.name).toBe("Aloo Bhujia");
    expect(await credits(u)).toBe(19);
    const t = await txns(u);
    expect(t.filter((x) => x.type === "debit")).toHaveLength(1);
    expect(t.filter((x) => x.type === "refund")).toHaveLength(0);
  });

  it("a crowd upsert never overwrites an OFF row holding the same barcode", async () => {
    const u = await createUser();
    const offRow = await upsertFood(toFoodDraft(offRec(NAMKEEN_CODE, { energyKcal: 500, protein: 10, carbs: 50, fat: 30 }), []));
    const j = jobs();
    const r = await createScan(u, aiInput(), deps(u, { extract: extracting(labelNamkeen) }), j.schedule);
    await j.runAll();
    const rows = await testDb().select().from(food).where(eq(food.barcode, NAMKEEN_CODE));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: offRow.id, source: "off", per100: offRow.per100, updatedAt: offRow.updatedAt });
    const [s] = await scansOf(u);
    expect(s!.status).toBe("done");
    expect(s!.foodId).toBeNull(); // label result is scan-only; no crowd row was created
    expect(body(r).scanId).toBe(s!.id);
  });

  it("a crowd food without a barcode is deduped on (source, normName, normBrand); a repeat label refreshes the same row", async () => {
    const u = await createUser();
    const j = jobs();
    const d = deps(u, { extract: extracting(labelNoBarcode) });
    await createScan(u, aiInput(), d, j.schedule);
    await j.runAll();
    await createScan(u, aiInput(), d, j.schedule);
    await j.runAll();
    const crowd = await testDb().select().from(food).where(eq(food.source, "crowd"));
    expect(crowd).toHaveLength(1);
    expect(crowd[0]!.barcode).toBeNull();
    const ss = await scansOf(u);
    expect(ss.map((s) => s.foodId)).toEqual([crowd[0]!.id, crowd[0]!.id]);
  });

  it("an engine failure (UNREADABLE_IMAGE) marks the scan failed and refunds, balance back", async () => {
    const u = await createUser();
    const j = jobs();
    const r = await createScan(u, aiInput(), deps(u, { extract: extracting(unreadable) }), j.schedule);
    expect(await credits(u)).toBe(19);
    await j.runAll();
    const [s] = await scansOf(u);
    expect(s).toMatchObject({ status: "failed", errorCode: "UNREADABLE_IMAGE", charged: true });
    expect(await credits(u)).toBe(20);
    const refunds = (await txns(u)).filter((t) => t.type === "refund");
    expect(refunds).toHaveLength(1);
    expect(refunds[0]!.idempotencyKey).toBe(`refund:${body(r).scanId}`);
    const view = await getScan(u, body(r).scanId, clock);
    expect(view).toMatchObject({ status: "failed", errorCode: "UNREADABLE_IMAGE", refunded: true });
    expect(view!.errorMessage).toMatch(new RegExp(`${REFUNDED_MESSAGE}$`));
  });

  it("keeps the engine's more specific sentence (unknown front of pack) and maps unknown errors to MODEL_ERROR", async () => {
    const u = await createUser();
    const j = jobs();
    const a = await createScan(u, aiInput(), deps(u, { extract: extracting(frontOnly) }), j.schedule);
    const b = await createScan(u, aiInput(), deps(u, { extract: vi.fn(async () => { throw new Error("socket hang up: secret detail"); }) }), j.schedule);
    const c = await createScan(u, aiInput(), deps(u, { extract: vi.fn(async () => { throw new EngineError("TIMEOUT", "The scan took too long and timed out. Please try again."); }) }), j.schedule);
    await j.runAll();
    const va = await getScan(u, body(a).scanId, clock);
    expect(va).toMatchObject({ status: "failed", errorCode: "UNREADABLE_IMAGE" });
    expect(va!.errorMessage).toBe(`We don't know this product yet — add a photo of the nutrition label. ${REFUNDED_MESSAGE}`);
    const vb = await getScan(u, body(b).scanId, clock);
    expect(vb).toMatchObject({ status: "failed", errorCode: "MODEL_ERROR" });
    expect(vb!.errorMessage).toBe(`${SCAN_MESSAGES.MODEL_ERROR} ${REFUNDED_MESSAGE}`); // raw error text never reaches the user
    expect(await getScan(u, body(c).scanId, clock)).toMatchObject({ status: "failed", errorCode: "TIMEOUT" });
    expect(await credits(u)).toBe(20);
  });

  it("missing API key → 503 SERVICE_BUSY 'Scanning isn't set up yet.', no charge, no scan row", async () => {
    const u = await createUser();
    const r = await createScan(u, aiInput(), deps(u, { config: () => ({ aiEnabled: false, dailyAiScanCap: 300 }) }), jobs().schedule);
    expect(r.status).toBe(503);
    expect(body(r).error).toEqual({ code: "SERVICE_BUSY", message: NOT_CONFIGURED_MESSAGE });
    expect(await scansOf(u)).toHaveLength(0);
    expect(await credits(u)).toBe(20);
  });

  it("balance 0 → 402 NO_CREDITS and no scan row, no debit row", async () => {
    const u = await createUser();
    await getBalance(u, new Date(clock));
    await testDb().update(profile).set({ credits: 0 }).where(eq(profile.userId, u));
    const j = jobs();
    const r = await createScan(u, aiInput(), deps(u, { extract: extracting(labelNamkeen) }), j.schedule);
    expect(r.status).toBe(402);
    expect(body(r).error).toEqual({ code: "NO_CREDITS", message: SCAN_MESSAGES.NO_CREDITS });
    expect(await scansOf(u)).toHaveLength(0);
    expect((await txns(u)).filter((t) => t.type === "debit")).toHaveLength(0);
    expect(j.count).toBe(0);
  });

  it("a barcode + photos whose barcode is unknown continues as a charged AI scan", async () => {
    const u = await createUser();
    const j = jobs();
    const r = await createScan(u, aiInput({ barcode: OTHER_CODE }), deps(u, { extract: extracting(labelNamkeen) }), j.schedule);
    expect(r.status).toBe(202);
    await j.runAll();
    const [s] = await scansOf(u);
    expect(s).toMatchObject({ status: "done", barcode: OTHER_CODE, charged: true });
  });
});

// --- limits & concurrency ------------------------------------------------------------------------

describe("rate limits and daily caps", () => {
  it("double POST within a second (different keys) → two scans, each charged once, balance −2", async () => {
    const u = await createUser();
    const d = deps(u, { extract: extracting(labelNamkeen) });
    const j = jobs();
    const [a, b] = await Promise.all([
      createScan(u, aiInput({ clientRequestId: "key-a-000001" }), d, j.schedule),
      createScan(u, aiInput({ clientRequestId: "key-b-000001" }), d, j.schedule),
    ]);
    expect([a.status, b.status]).toEqual([202, 202]);
    expect(body(a).scanId).not.toBe(body(b).scanId);
    expect(await credits(u)).toBe(18);
    const debits = (await txns(u)).filter((t) => t.type === "debit");
    expect(debits).toHaveLength(2);
    expect(new Set(debits.map((t) => t.idempotencyKey)).size).toBe(2);
  });

  it("serialises concurrent creates per user: 6 at once → exactly 5 accepted, one 429, 5 charges", async () => {
    const u = await createUser();
    const d = deps(u, { extract: extracting(labelNamkeen) });
    const j = jobs();
    const results = await Promise.all(Array.from({ length: 6 }, () => createScan(u, aiInput(), d, j.schedule)));
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([202, 202, 202, 202, 202, 429]);
    const limited = results.find((r) => r.status === 429)!;
    expect(body(limited).error).toEqual({ code: "RATE_LIMITED", message: "Too many scans — wait a minute." });
    expect(await scansOf(u)).toHaveLength(5);
    expect(await credits(u)).toBe(15);
    expect((await txns(u)).filter((t) => t.type === "debit")).toHaveLength(5);
  });

  it("the 6th scan within 60 s → 429 (barcode scans count too); after the window it's allowed again", async () => {
    const u = await createUser();
    const d = deps(u);
    for (let i = 0; i < 5; i++) {
      expect((await createScan(u, { images: [], barcode: OTHER_CODE }, d, jobs().schedule)).status).toBe(200);
      advance(1000);
    }
    const sixth = await createScan(u, { images: [], barcode: OTHER_CODE }, d, jobs().schedule);
    expect(sixth.status).toBe(429);
    expect(body(sixth).error!.code).toBe("RATE_LIMITED");
    expect(await scansOf(u)).toHaveLength(5);
    advance(60_000);
    expect((await createScan(u, { images: [], barcode: OTHER_CODE }, d, jobs().schedule)).status).toBe(200);
  });

  it("25 charged scans today (refunded ones included) → 429 DAILY_LIMIT; yesterday's don't count", async () => {
    const u = await createUser();
    const earlier = new Date(T0 - 2 * 3600_000); // today, outside the 60 s window
    const yesterday = new Date(T0 - 24 * 3600_000);
    const row = (createdAt: Date, status: "done" | "failed") => ({ userId: u, status, imageCount: 1, engineVersion: "e", charged: true, createdAt });
    await testDb().insert(scan).values([
      ...Array.from({ length: 24 }, () => row(earlier, "done")),
      row(yesterday, "done"),
    ]);
    const d = deps(u, { extract: extracting(labelNamkeen) });
    const j = jobs();
    expect((await createScan(u, aiInput(), d, j.schedule)).status).toBe(202); // the 25th
    await testDb().update(scan).set({ status: "failed" }).where(and(eq(scan.userId, u), eq(scan.status, "queued"))); // refunded or not, still counts
    advance(61_000);
    const r = await createScan(u, aiInput(), d, j.schedule);
    expect(r.status).toBe(429);
    expect(body(r).error!.code).toBe("DAILY_LIMIT");
    expect(await credits(u)).toBe(19);
    // Free barcode scans are unaffected.
    expect((await createScan(u, { images: [], barcode: OTHER_CODE }, d, j.schedule)).status).toBe(200);
  });

  it("the global DAILY_AI_SCAN_CAP counts charged scans across users → 503 SERVICE_BUSY, no charge", async () => {
    const other = await createUser();
    const u = await createUser();
    await testDb().insert(scan).values(Array.from({ length: 2 }, () => ({ userId: other, status: "done" as const, imageCount: 1, engineVersion: "e", charged: true, createdAt: new Date(T0 - 3600_000) })));
    const r = await createScan(u, aiInput(), deps(u, { config: () => ({ aiEnabled: true, dailyAiScanCap: 2 }) }), jobs().schedule);
    expect(r.status).toBe(503);
    expect(body(r).error).toEqual({ code: "SERVICE_BUSY", message: SCAN_MESSAGES.SERVICE_BUSY });
    expect(await scansOf(u)).toHaveLength(0);
    expect(await credits(u)).toBe(20);
  });
});

// --- idempotency ---------------------------------------------------------------------------------

describe("Idempotency-Key", () => {
  it("replaying the same key never charges twice and returns the scan's current state", async () => {
    const u = await createUser();
    const d = deps(u, { extract: extracting(labelNamkeen) });
    const j = jobs();
    const first = await createScan(u, aiInput({ clientRequestId: "press-1-abcdef" }), d, j.schedule);
    const replay = await createScan(u, aiInput({ clientRequestId: "press-1-abcdef" }), d, j.schedule);
    expect(first.status).toBe(202);
    expect(replay.status).toBe(202);
    expect(body(replay)).toMatchObject({ scanId: body(first).scanId, status: "queued" });
    expect(j.count).toBe(1); // no second job
    await j.runAll();
    const done = await createScan(u, aiInput({ clientRequestId: "press-1-abcdef" }), d, j.schedule);
    expect(done.status).toBe(200);
    expect(body(done)).toMatchObject({ scanId: body(first).scanId, status: "done" });
    expect(await scansOf(u)).toHaveLength(1);
    expect(await credits(u)).toBe(19);
    expect((await txns(u)).filter((t) => t.type === "debit")).toHaveLength(1);
  });

  it("concurrent requests with the same key create one scan and one charge", async () => {
    const u = await createUser();
    const d = deps(u, { extract: extracting(labelNamkeen) });
    const j = jobs();
    const rs = await Promise.all(Array.from({ length: 3 }, () => createScan(u, aiInput({ clientRequestId: "press-2-abcdef" }), d, j.schedule)));
    expect(new Set(rs.map((r) => body(r).scanId)).size).toBe(1);
    expect(rs.every((r) => r.status === 202)).toBe(true);
    expect(await scansOf(u)).toHaveLength(1);
    expect(await credits(u)).toBe(19);
    expect(j.count).toBe(1);
  });

  it("replays a free barcode scan too, and keys are per user", async () => {
    const u = await createUser();
    const v = await createUser();
    const a = await createScan(u, { images: [], barcode: OTHER_CODE, clientRequestId: "press-3-abcdef" }, deps(u), jobs().schedule);
    const b = await createScan(u, { images: [], barcode: OTHER_CODE, clientRequestId: "press-3-abcdef" }, deps(u), jobs().schedule);
    expect(b.status).toBe(200);
    expect(body(b).scanId).toBe(body(a).scanId);
    const c = await createScan(v, { images: [], barcode: OTHER_CODE, clientRequestId: "press-3-abcdef" }, deps(v), jobs().schedule);
    expect(body(c).scanId).not.toBe(body(a).scanId);
  });
});

// --- stuck sweep, late completion, delete --------------------------------------------------------

describe("stuck sweep and late completion", () => {
  it("late finish after sweep: getScan at +4 min fails + refunds; the late job then changes nothing", async () => {
    const u = await createUser();
    const j = jobs();
    const r = await createScan(u, aiInput(), deps(u, { extract: extracting(labelNamkeen) }), j.schedule);
    const id = body(r).scanId;
    advance(4 * 60_000);
    const swept = await getScan(u, id, clock);
    expect(swept).toMatchObject({ status: "failed", errorCode: "TIMEOUT", refunded: true });
    expect(await credits(u)).toBe(20);
    await j.runAll(); // the job never got to start: queued → processing misses
    const [s] = await scansOf(u);
    expect(s!.status).toBe("failed");
    expect(s!.result).toBeNull();
    expect((await txns(u)).filter((t) => t.type === "refund")).toHaveLength(1);
    expect(await credits(u)).toBe(20);
  });

  it("a job already processing when the sweep lands cannot complete the scan or refund twice", async () => {
    const u = await createUser();
    let release!: () => void;
    const gate = new Promise<void>((res) => { release = res; });
    const extract = vi.fn(async () => { await gate; return out(labelNamkeen); });
    const j = jobs();
    const r = await createScan(u, aiInput(), deps(u, { extract }), j.schedule);
    const id = body(r).scanId;
    const running = j.runAll();
    await vi.waitFor(() => expect(extract).toHaveBeenCalled());
    expect((await scansOf(u))[0]!.status).toBe("processing");
    advance(4 * 60_000);
    expect(await getScan(u, id, clock)).toMatchObject({ status: "failed", errorCode: "TIMEOUT" });
    release();
    await running;
    const [s] = await scansOf(u);
    expect(s).toMatchObject({ status: "failed", errorCode: "TIMEOUT", result: null });
    expect((await txns(u)).filter((t) => t.type === "refund")).toHaveLength(1);
    expect(await credits(u)).toBe(20);
    expect(await testDb().select().from(food).where(eq(food.source, "crowd"))).toHaveLength(0); // crowd write rolled back
  });

  it("a scan younger than 3 min is not swept", async () => {
    const u = await createUser();
    const r = await createScan(u, aiInput(), deps(u, { extract: extracting(labelNamkeen) }), jobs().schedule);
    advance(2 * 60_000);
    expect(await getScan(u, body(r).scanId, clock)).toMatchObject({ status: "queued" });
  });

  it("listScans and createScan also sweep the user's stale scans", async () => {
    const u = await createUser();
    const d = deps(u, { extract: extracting(labelNamkeen) });
    const a = await createScan(u, aiInput(), d, jobs().schedule);
    advance(4 * 60_000);
    await listScans(u, {}, clock);
    expect((await scansOf(u)).find((s) => s.id === body(a).scanId)!.status).toBe("failed");

    const b = await createScan(u, aiInput(), d, jobs().schedule);
    advance(4 * 60_000);
    await createScan(u, { images: [], barcode: OTHER_CODE }, d, jobs().schedule);
    expect((await scansOf(u)).find((s) => s.id === body(b).scanId)!.status).toBe("failed");
    expect(await credits(u)).toBe(20);
  });

  it("completeScan on a scan that isn't queued is a no-op", async () => {
    const u = await createUser();
    const [s] = await testDb().insert(scan).values({ userId: u, status: "done", imageCount: 1, engineVersion: "e", createdAt: new Date(clock) }).returning();
    const extract = extracting(labelNamkeen);
    await completeScan(s!.id, u, { barcode: null, images: [IMG], profile: { country: "IN", allergies: [], diet: "none", goal: "general", targets: PRESETS.general } }, deps(u, { extract }), { deadline: clock + 50_000 });
    expect(extract).not.toHaveBeenCalled();
  });
});

describe("deleteScan and ownership", () => {
  it("delete while running → failed + refunded, then gone; the job's later write is a no-op", async () => {
    const u = await createUser();
    const j = jobs();
    const r = await createScan(u, aiInput(), deps(u, { extract: extracting(labelNamkeen) }), j.schedule);
    const id = body(r).scanId;
    expect(await credits(u)).toBe(19);
    expect(await deleteScan(u, id, clock)).toBe(true);
    let [s] = await scansOf(u);
    expect(s).toMatchObject({ status: "failed", charged: true }); // soft-deleted, still counted
    expect(s!.deletedAt).not.toBeNull();
    expect(await credits(u)).toBe(20);
    await j.runAll();
    [s] = await scansOf(u);
    expect(s).toMatchObject({ status: "failed", result: null });
    const refunds = (await txns(u)).filter((t) => t.type === "refund");
    expect(refunds).toHaveLength(1);
    expect(refunds[0]!.idempotencyKey).toBe(`refund:${id}`);
    expect(await credits(u)).toBe(20);
    expect(await getScan(u, id, clock)).toBeNull();
    expect(await deleteScan(u, id, clock)).toBe(false);
  });

  it("deleting a done scan doesn't refund", async () => {
    const u = await createUser();
    const j = jobs();
    const r = await createScan(u, aiInput(), deps(u, { extract: extracting(labelNamkeen) }), j.schedule);
    await j.runAll();
    expect(await deleteScan(u, body(r).scanId, clock)).toBe(true);
    expect(await credits(u)).toBe(19);
  });

  it("another user's scan id → null / false (404) and untouched; a malformed id → null", async () => {
    const a = await createUser();
    const b = await createUser();
    const r = await createScan(a, aiInput(), deps(a, { extract: extracting(labelNamkeen) }), jobs().schedule);
    const id = body(r).scanId;
    advance(4 * 60_000); // even a stale one: b's read must not sweep a's scan
    expect(await getScan(b, id, clock)).toBeNull();
    expect(await deleteScan(b, id, clock)).toBe(false);
    expect((await listScans(b, {}, clock)).scans).toHaveLength(0);
    expect((await scansOf(a))[0]!.status).toBe("queued");
    expect(await credits(a)).toBe(19);
    expect(await getScan(a, "not-a-uuid", clock)).toBeNull();
    expect(await deleteScan(a, "not-a-uuid", clock)).toBe(false);
  });
});

describe("listScans", () => {
  it("pages newest first with a cursor and filters by grade and name", async () => {
    const u = await createUser();
    const grade = (g: string, name: string) => ({ name, grade: g }) as unknown as NonNullable<typeof scan.$inferInsert.result>;
    const rows = Array.from({ length: 25 }, (_, i) => ({
      userId: u, status: "done" as const, imageCount: 1, engineVersion: "e", createdAt: new Date(T0 - (25 - i) * 60_000),
      result: grade(i % 2 ? "A" : "E", i === 3 ? "Aloo Bhujia 100%_x" : `Food ${i}`), inputKind: "label" as const, confidence: "high" as const,
    }));
    await testDb().insert(scan).values(rows);
    const p1 = await listScans(u, {}, clock);
    expect(p1.scans).toHaveLength(20);
    expect(p1.scans[0]!.name).toBe("Food 24");
    expect(p1.nextCursor).not.toBeNull();
    const p2 = await listScans(u, { cursor: p1.nextCursor! }, clock);
    expect(p2.scans).toHaveLength(5);
    expect(p2.nextCursor).toBeNull();
    expect(new Set([...p1.scans, ...p2.scans].map((s) => s.id)).size).toBe(25);

    const a = await listScans(u, { grade: "A" }, clock);
    expect(a.scans.every((s) => s.grade === "A")).toBe(true);
    expect(a.scans).toHaveLength(12);
    expect((await listScans(u, { q: "bhujia" }, clock)).scans.map((s) => s.name)).toEqual(["Aloo Bhujia 100%_x"]);
    expect((await listScans(u, { q: "100%" }, clock)).scans).toHaveLength(1); // LIKE wildcards are literal
    expect((await listScans(u, { q: "_" }, clock)).scans).toHaveLength(1);
    expect(p1.scans[0]).toMatchObject({ status: "done", inputKind: "label", confidence: "high", grade: "E", errorCode: null });
  });
});

describe("soft delete keeps deleted scans in every guard", () => {
  it("create → NOT_FOOD (refunded) → delete, 26 times: the 26th is 429 DAILY_LIMIT", async () => {
    const u = await createUser();
    const notFood = sanitiseExtraction({ images: [{ index: 0, kind: "not_food", quality: [] }] });
    const d = deps(u, { extract: extracting(notFood) });
    const j = jobs();
    for (let i = 0; i < 25; i++) {
      const r = await createScan(u, aiInput(), d, j.schedule);
      expect(r.status).toBe(202);
      await j.runAll();
      expect(await getScan(u, body(r).scanId, clock)).toMatchObject({ status: "failed", errorCode: "NOT_FOOD", refunded: true });
      expect(await deleteScan(u, body(r).scanId, clock)).toBe(true);
      advance(61_000);
    }
    const r = await createScan(u, aiInput(), d, j.schedule);
    expect(r.status).toBe(429);
    expect(body(r).error!.code).toBe("DAILY_LIMIT");
    expect(await credits(u)).toBe(20);
    expect((await listScans(u, {}, clock)).scans).toHaveLength(0);
    // daily_ai_cost still sees all 25 model calls.
    const [cost] = (await testDb().execute(sql`SELECT ai_scans::int AS n FROM daily_ai_cost`)).rows as { n: number }[];
    expect(cost!.n).toBe(25);
  });

  it("6 create → delete rounds inside 60 s: the 6th is 429 RATE_LIMITED", async () => {
    const u = await createUser();
    const d = deps(u, { extract: extracting(labelNamkeen) });
    for (let i = 0; i < 5; i++) {
      const r = await createScan(u, aiInput(), d, jobs().schedule);
      expect(r.status).toBe(202);
      expect(await deleteScan(u, body(r).scanId, clock)).toBe(true);
      advance(1000);
    }
    const sixth = await createScan(u, aiInput(), d, jobs().schedule);
    expect(sixth.status).toBe(429);
    expect(body(sixth).error!.code).toBe("RATE_LIMITED");
    expect(await credits(u)).toBe(20);
  });

  it("a scan deleted while processing still counts toward the daily cap", async () => {
    const u = await createUser();
    const earlier = new Date(T0 - 2 * 3600_000);
    await testDb().insert(scan).values(Array.from({ length: 24 }, () => ({ userId: u, status: "done" as const, imageCount: 1, engineVersion: "e", charged: true, createdAt: earlier })));
    let release!: () => void;
    const gate = new Promise<void>((res) => { release = res; });
    const extract = vi.fn(async () => { await gate; return out(labelNamkeen); });
    const j = jobs();
    const r = await createScan(u, aiInput(), deps(u, { extract }), j.schedule);
    const running = j.runAll();
    await vi.waitFor(() => expect(extract).toHaveBeenCalled());
    expect(await deleteScan(u, body(r).scanId, clock)).toBe(true);
    release();
    await running;
    const [s] = await testDb().select().from(scan).where(eq(scan.id, body(r).scanId));
    expect(s).toMatchObject({ status: "failed", charged: true });
    expect(s!.deletedAt).not.toBeNull();
    advance(61_000);
    const next = await createScan(u, aiInput(), deps(u, { extract: extracting(labelNamkeen) }), jobs().schedule);
    expect(next.status).toBe(429);
    expect(body(next).error!.code).toBe("DAILY_LIMIT");
  });

  it("a deleted scan is 404 on get, absent from the list, and can't be deleted again", async () => {
    const u = await createUser();
    const j = jobs();
    const r = await createScan(u, aiInput(), deps(u, { extract: extracting(labelNamkeen) }), j.schedule);
    await j.runAll();
    expect(await deleteScan(u, body(r).scanId, clock)).toBe(true);
    expect(await getScan(u, body(r).scanId, clock)).toBeNull();
    expect((await listScans(u, {}, clock)).scans).toHaveLength(0);
    expect(await deleteScan(u, body(r).scanId, clock)).toBe(false);
    expect(await testDb().select().from(scan).where(visibleScanWhere(u))).toHaveLength(0);
    expect(await credits(u)).toBe(19); // a done scan is not refunded on delete
  });

  it("replaying an Idempotency-Key after its scan was deleted → 409 CONFLICT, no new scan, no charge", async () => {
    const u = await createUser();
    const d = deps(u, { extract: extracting(labelNamkeen) });
    const r = await createScan(u, aiInput({ clientRequestId: "press-del-0001" }), d, jobs().schedule);
    await deleteScan(u, body(r).scanId, clock);
    const replay = await createScan(u, aiInput({ clientRequestId: "press-del-0001" }), d, jobs().schedule);
    expect(replay.status).toBe(409);
    expect(body(replay).error).toEqual({ code: "CONFLICT", message: "That scan was deleted." });
    expect(await scansOf(u)).toHaveLength(1);
    expect(await credits(u)).toBe(20);
  });

  it("account deletion still removes the user's scans", async () => {
    const u = await createUser();
    const r = await createScan(u, aiInput(), deps(u, { extract: extracting(labelNamkeen) }), jobs().schedule);
    await deleteScan(u, body(r).scanId, clock);
    await testDb().delete(user).where(eq(user.id, u));
    expect(await testDb().select().from(scan).where(eq(scan.userId, u))).toHaveLength(0);
  });
});

// --- Per-serving label with no serving weight (final review I2) ------------------------------------

describe("per-serving label without a serving weight (Masala Oats, 160 kcal / 420 mg sodium per serving)", () => {
  async function scanOats(u: string) {
    const j = jobs();
    const r = await createScan(u, aiInput(), deps(u, { extract: extracting(sanitiseExtraction(perServingJson)) }), j.schedule);
    await j.runAll();
    return body(r).scanId;
  }

  it("logs whole servings with the printed numbers and refuses grams", async () => {
    const u = await createUser();
    const id = await scanOats(u);
    const view = await getScan(u, id, clock);
    expect(view!.result).toMatchObject({ per100: null, servingUnknown: true, grade: null, perServing: { energyKcal: 160, sodiumMg: 420 } });

    const date = new Date(clock).toISOString().slice(0, 10);
    const one = await addEntry(u, { kind: "scan", date, meal: "breakfast", scanId: id, portionIndex: 0, quantity: 1 });
    expect(one.nutrients).toMatchObject({ energyKcal: 160, sodiumMg: 420 });
    expect(one.portion).toEqual({ label: "1 serving", amount: 1, unit: "serving", grams: null });
    const two = await addEntry(u, { kind: "scan", date, meal: "breakfast", scanId: id, portionIndex: 0, quantity: 2 });
    expect(two.nutrients).toMatchObject({ energyKcal: 320, sodiumMg: 840 });
    // Editing the quantity later keeps the per-serving scaling.
    expect((await updateEntry(u, one.id, { quantity: 1.5 }))!.nutrients).toMatchObject({ energyKcal: 240, sodiumMg: 630 });

    // The 40 g case from the review: logging by grams is not possible.
    await expect(addEntry(u, { kind: "scan_grams", date, meal: "breakfast", scanId: id, grams: 40 })).rejects.toBeInstanceOf(InvalidError);
  });

  it("can't be saved to my foods (there is no per-100 g figure to store)", async () => {
    const u = await createUser();
    const id = await scanOats(u);
    await expect(createCustomFoodFromScan(u, id)).rejects.toBeInstanceOf(InvalidError);
    expect(await testDb().select().from(food).where(eq(food.ownerId, u))).toHaveLength(0);
  });
});
