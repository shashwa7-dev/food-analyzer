// Scan image on R2, against the in-memory fake store: one 480 px image from the first photo, put only
// after the scan succeeded and never touching the charge; signed URL; soft delete and account deletion;
// barcode, failed and throwing jobs put nothing; a disabled store is a no-op.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createUser, resetDb, testDb } from "@/tests/helpers/db";
import { creditTxn, scan } from "@/lib/db/schema";
import { getBalance } from "@/lib/credits/ledger";
import { deleteAccount } from "@/lib/profile/service";
import type { ExtractOutput } from "@/lib/engine";
import { sanitiseExtraction, type EngineImage, type Extraction } from "@/lib/engine/schema";
import { upsertFood } from "@/lib/foods/insert";
import { toFoodDraft, type SourceRecord } from "@/lib/foods/seed-map";
import labelNamkeenJson from "@/lib/engine/__fixtures__/label-namkeen.json";
import unreadableJson from "@/lib/engine/__fixtures__/unreadable.json";
import { createFakeStore, FAKE_PHOTO_HOST, type FakePhotoStore } from "@/lib/storage/fake";
import { setPhotoStoreForTests } from "@/lib/storage/r2";
import { realDeps } from "./deps";
import { createScan, deleteScan, getScan, listScans, type CreateScanInput, type ScanDeps, type Schedule } from "./service";

const T0 = Date.parse("2026-10-07T10:00:00Z");
const DAY = 86_400_000;
let clock = T0;
const now = () => clock;

const JPEG = new Uint8Array(readFileSync(join(__dirname, "__fixtures__/exif-gps.jpg")));
const PHOTO: EngineImage = { mime: "image/jpeg", data: JPEG };
const NAMKEEN_CODE = "8901491101837";

const out = (data: Extraction): ExtractOutput => ({ data, usage: { inputTokens: 1200, outputTokens: 300 }, modelId: "gemini-3.5-flash-lite", costMicros: 1110 });
const labelNamkeen = sanitiseExtraction(labelNamkeenJson);
const unreadable = sanitiseExtraction(unreadableJson);

function deps(userId: string, extraction: Extraction = labelNamkeen): ScanDeps {
  return {
    ...realDeps(userId),
    lookupOffByBarcode: vi.fn(async () => ({ status: "not_found" as const })),
    extract: vi.fn(async () => out(extraction)),
    config: () => ({ aiEnabled: true, dailyAiScanCap: 300 }),
    now,
  };
}

function jobs() {
  const pending: (() => Promise<void>)[] = [];
  const schedule: Schedule = (fn) => { pending.push(fn); };
  return { schedule, get count() { return pending.length; }, async runAll() { while (pending.length) await pending.shift()!(); } };
}

const aiInput = (o: Partial<CreateScanInput> = {}): CreateScanInput => ({ images: [PHOTO, PHOTO], barcode: null, ...o });
const credits = async (u: string) => (await getBalance(u, new Date(clock))).credits;
const debits = async (u: string) => (await testDb().select().from(creditTxn).where(eq(creditTxn.userId, u))).filter((t) => t.type === "debit");
const rowOf = async (id: string) => (await testDb().select().from(scan).where(eq(scan.id, id)))[0]!;
const idOf = (r: { body: unknown }) => (r.body as { scanId: string }).scanId;

/** A done, charged AI scan with its photos stored. */
async function scanWithPhotos(u: string, images: EngineImage[] = [PHOTO, PHOTO]) {
  const j = jobs();
  const r = await createScan(u, aiInput({ images }), deps(u), j.schedule);
  await j.runAll();
  return idOf(r);
}

let store: FakePhotoStore;

beforeEach(async () => {
  clock = T0;
  await resetDb();
  store = createFakeStore();
  setPhotoStoreForTests(store);
});
afterEach(() => setPhotoStoreForTests(undefined));

describe("scan image: upload", () => {
  it("stores exactly one image, only after the job has succeeded, recorded on the done scan", async () => {
    const u = await createUser();
    const j = jobs();
    const r = await createScan(u, aiInput({ images: [PHOTO, PHOTO, PHOTO] }), deps(u), j.schedule);
    expect(r.status).toBe(202);
    expect(await credits(u)).toBe(19); // charged at create...
    expect(store.puts).toEqual([]); // ...and nothing uploaded until the job runs
    expect(j.count).toBe(1); // still one job

    await j.runAll();
    const id = idOf(r);
    expect(store.keys()).toEqual([`thumb/u/${u}/${id}.webp`]);
    expect(store.puts).toEqual([`thumb/u/${u}/${id}.webp`]);
    expect(store.objects.get(`thumb/u/${u}/${id}.webp`)!.contentType).toBe("image/webp");
    expect(await rowOf(id)).toMatchObject({ status: "done", charged: true, thumbnailKey: `thumb/u/${u}/${id}.webp` });
    expect(await credits(u)).toBe(19);
    expect(await debits(u)).toHaveLength(1);
  });

  it("a failed upload leaves the scan done and charged, with no image", async () => {
    const u = await createUser();
    store.failPuts = true;
    const id = await scanWithPhotos(u);
    expect(store.keys()).toEqual([]);
    expect(await rowOf(id)).toMatchObject({ status: "done", charged: true, thumbnailKey: null });
    expect(await credits(u)).toBe(19);
    expect(await debits(u)).toHaveLength(1);
    expect(await getScan(u, id, clock)).toMatchObject({ status: "done", refunded: false, imageUrl: null });
  });

  it("an undecodable first photo stores nothing, without touching the scan", async () => {
    const u = await createUser();
    const junk: EngineImage = { mime: "image/jpeg", data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]) };
    const id = await scanWithPhotos(u, [junk, PHOTO]);
    expect(store.puts).toEqual([]);
    expect(await rowOf(id)).toMatchObject({ status: "done", charged: true, thumbnailKey: null });
    expect(await credits(u)).toBe(19);
  });

  it("a barcode-only scan uploads nothing", async () => {
    const u = await createUser();
    await upsertFood(toFoodDraft({
      source: "off", sourceRef: NAMKEEN_CODE, barcode: NAMKEEN_CODE, name: "Aloo Bhujia", brand: "Shree Rama", basis: "per_100g",
      per100: { energyKcal: 554, protein: 11, carbs: 51.7, fat: 34 }, portions: [], categories: [], countries: ["IN"],
    } satisfies SourceRecord, []));
    const j = jobs();
    const r = await createScan(u, { images: [], barcode: NAMKEEN_CODE }, deps(u), j.schedule);
    expect(r.status).toBe(200);
    expect(j.count).toBe(0);
    expect(store.puts).toEqual([]);
    expect(await rowOf(idOf(r))).toMatchObject({ thumbnailKey: null });
  });

  it("a failed (refunded) AI scan puts nothing at all, and the credit is back", async () => {
    const u = await createUser();
    const j = jobs();
    const r = await createScan(u, aiInput(), deps(u, unreadable), j.schedule);
    await j.runAll();
    expect(await rowOf(idOf(r))).toMatchObject({ status: "failed", thumbnailKey: null });
    expect(store.puts).toEqual([]);
    expect(store.keys()).toEqual([]);
    expect(await credits(u)).toBe(20);
  });

  it("a job that throws puts nothing at all", async () => {
    const u = await createUser();
    let broken = false;
    const d: ScanDeps = {
      ...deps(u),
      // The model call fails, then the clock throws inside completeScan's failure path, so the job rejects.
      extract: vi.fn(async () => { broken = true; throw new Error("model down"); }),
      now: () => { if (broken) throw new Error("clock broke"); return clock; },
    };
    const j = jobs();
    const r = await createScan(u, aiInput(), d, j.schedule);
    await expect(j.runAll()).rejects.toThrow("clock broke");
    expect(store.puts).toEqual([]);
    expect(await rowOf(idOf(r))).toMatchObject({ thumbnailKey: null });
  });

  it("a scan deleted before its job runs leaves nothing in the store", async () => {
    const u = await createUser();
    const j = jobs();
    const r = await createScan(u, aiInput(), deps(u), j.schedule);
    expect(await deleteScan(u, idOf(r), clock, jobs().schedule)).toBe(true);
    await j.runAll();
    expect(store.keys()).toEqual([]);
    expect(await rowOf(idOf(r))).toMatchObject({ thumbnailKey: null });
  });

  it("a scan deleted between the status check and the record has its upload removed again", async () => {
    const u = await createUser();
    const j = jobs();
    const r = await createScan(u, aiInput(), deps(u), j.schedule);
    const id = idOf(r);
    const put = store.put.bind(store);
    store.put = async (key, bytes, type) => {
      await put(key, bytes, type);
      await deleteScan(u, id, clock, jobs().schedule); // the user deletes it mid-upload
    };
    await j.runAll();
    expect(store.puts).toHaveLength(1);
    expect(store.keys()).toEqual([]);
    expect(await rowOf(id)).toMatchObject({ thumbnailKey: null });
  });
});

describe("scan image: URL", () => {
  it("getScan signs the image (10 min); listScans too", async () => {
    const u = await createUser();
    const id = await scanWithPhotos(u);
    const url = `${FAKE_PHOTO_HOST}/thumb/u/${u}/${id}.webp?ttl=600`;
    const view = await getScan(u, id, clock);
    expect(view!.imageUrl).toBe(url);
    expect(view).not.toHaveProperty("photoUrls");
    const { scans } = await listScans(u, {}, clock);
    expect(scans[0]).toMatchObject({ id, imageUrl: url });
    expect(scans[0]).not.toHaveProperty("thumbnailKey");
  });

  it("the image does not expire", async () => {
    const u = await createUser();
    const id = await scanWithPhotos(u);
    clock = T0 + 90 * DAY;
    expect((await getScan(u, id, clock))!.imageUrl).not.toBeNull();
  });

  it("a scan without an image (barcode not found) has a null URL", async () => {
    const u = await createUser();
    const j = jobs();
    const r = await createScan(u, { images: [], barcode: "4006381333931" }, deps(u), j.schedule);
    expect(await getScan(u, idOf(r), clock)).toMatchObject({ imageUrl: null });
  });
});

describe("scan image: deletion", () => {
  it("soft delete removes the scan's objects (after the delete), and only that scan's", async () => {
    const u = await createUser();
    const a = await scanWithPhotos(u);
    const b = await scanWithPhotos(u);
    expect(store.keys()).toHaveLength(2);
    const j = jobs();
    expect(await deleteScan(u, a, clock, j.schedule)).toBe(true);
    expect(store.keys()).toHaveLength(2); // deferred to after()
    await j.runAll();
    expect(store.keys()).toEqual([`thumb/u/${u}/${b}.webp`]);
  });

  it("account deletion removes the user's prefix, and nobody else's", async () => {
    const u = await createUser();
    const other = await createUser();
    await scanWithPhotos(u);
    await scanWithPhotos(u, [PHOTO]);
    const kept = await scanWithPhotos(other, [PHOTO]);
    await deleteAccount(u);
    expect(store.keys()).toEqual([`thumb/u/${other}/${kept}.webp`]);
  });

  it("account deletion sweeps again after the commit, catching an image put in the meantime", async () => {
    const u = await createUser();
    await scanWithPhotos(u);
    const sweep = store.deletePrefix.bind(store);
    let calls = 0;
    store.deletePrefix = async (prefix) => {
      await sweep(prefix);
      // An in-flight job uploads an image right after the first sweep.
      if (++calls === 1) await store.put(`thumb/u/${u}/late.webp`, new Uint8Array([1]), "image/webp");
    };
    await deleteAccount(u);
    expect(calls).toBe(2);
    expect(store.keys()).toEqual([]);
  });

  it("with photosDeleted, deletion skips the first sweep and a failing second sweep doesn't stop it", async () => {
    const u = await createUser();
    await scanWithPhotos(u);
    let calls = 0;
    store.deletePrefix = async () => { calls++; throw new Error("R2 down"); };
    await deleteAccount(u, new Date(clock), { photosDeleted: true });
    expect(calls).toBe(1); // only the post-commit sweep, which gave up quietly
    expect(await testDb().select().from(scan).where(eq(scan.userId, u))).toHaveLength(0);
  });

  it("account deletion stops, account intact, when the photos can't be deleted", async () => {
    const u = await createUser();
    await scanWithPhotos(u);
    store.deletePrefix = async () => { throw new Error("R2 down"); };
    await expect(deleteAccount(u)).rejects.toThrow("R2 down");
    expect(await testDb().select().from(scan).where(eq(scan.userId, u))).toHaveLength(1);
  });
});

describe("scan image: storage off", () => {
  it("no upload, null URLs and an unchanged charge", async () => {
    setPhotoStoreForTests(null);
    const u = await createUser();
    const id = await scanWithPhotos(u);
    expect(await rowOf(id)).toMatchObject({ status: "done", charged: true, thumbnailKey: null });
    expect(await getScan(u, id, clock)).toMatchObject({ imageUrl: null });
    expect((await listScans(u, {}, clock)).scans[0]!.imageUrl).toBeNull();
    expect(await credits(u)).toBe(19);
    expect(await debits(u)).toHaveLength(1);
    expect(await deleteScan(u, id, clock, jobs().schedule)).toBe(true);
    await deleteAccount(u);
  });
});
