// Scan photos on R2 (spec §A Tests), against the in-memory fake store: uploads happen in the
// post-charge job and never touch the charge; URLs are signed; expiry, soft delete and account
// deletion; barcode and failed scans store nothing; a disabled store is a no-op.
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

describe("scan photos: upload", () => {
  it("uploads after the charge: display copies and a thumbnail, recorded on the done scan", async () => {
    const u = await createUser();
    const j = jobs();
    const r = await createScan(u, aiInput(), deps(u), j.schedule);
    expect(r.status).toBe(202);
    expect(await credits(u)).toBe(19); // charged at create…
    expect(store.keys()).toEqual([]); // …and nothing uploaded until the job runs
    expect(j.count).toBe(1); // still one job

    await j.runAll();
    const id = idOf(r);
    expect(store.keys()).toEqual([`display/u/${u}/${id}/1.webp`, `display/u/${u}/${id}/2.webp`, `thumb/u/${u}/${id}.webp`]);
    expect(store.objects.get(`thumb/u/${u}/${id}.webp`)!.contentType).toBe("image/webp");
    const s = await rowOf(id);
    expect(s).toMatchObject({ status: "done", charged: true, photoCount: 2, thumbnailKey: `thumb/u/${u}/${id}.webp` });
    expect(s.photosExpireAt!.getTime()).toBe(T0 + 30 * DAY);
    expect(await credits(u)).toBe(19);
    expect(await debits(u)).toHaveLength(1);
  });

  it("a failed upload leaves the scan done and charged, with no photos", async () => {
    const u = await createUser();
    store.failPuts = true;
    const id = await scanWithPhotos(u);
    expect(await rowOf(id)).toMatchObject({ status: "done", charged: true, photoCount: 0, thumbnailKey: null, photosExpireAt: null });
    expect(await credits(u)).toBe(19);
    expect(await debits(u)).toHaveLength(1);
    expect(await getScan(u, id, clock)).toMatchObject({ status: "done", refunded: false, photoUrls: [], thumbnailUrl: null });
  });

  it("an undecodable photo stores nothing (and removes what it had put) without touching the scan", async () => {
    const u = await createUser();
    const junk: EngineImage = { mime: "image/jpeg", data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]) };
    const id = await scanWithPhotos(u, [PHOTO, junk]);
    expect(store.keys()).toEqual([]);
    expect(await rowOf(id)).toMatchObject({ status: "done", charged: true, photoCount: 0 });
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
    expect(store.keys()).toEqual([]);
    expect(await rowOf(idOf(r))).toMatchObject({ photoCount: 0, thumbnailKey: null });
  });

  it("a failed (refunded) AI scan keeps no photos", async () => {
    const u = await createUser();
    const j = jobs();
    const r = await createScan(u, aiInput(), deps(u, unreadable), j.schedule);
    await j.runAll();
    expect(await rowOf(idOf(r))).toMatchObject({ status: "failed", photoCount: 0, thumbnailKey: null });
    expect(store.keys()).toEqual([]);
    expect(await credits(u)).toBe(20);
  });

  it("a job that throws still removes the photos it uploaded", async () => {
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
    expect(store.keys()).toEqual([]);
    expect(await rowOf(idOf(r))).toMatchObject({ photoCount: 0, thumbnailKey: null });
  });

  it("a scan deleted while its job runs keeps no photos", async () => {
    const u = await createUser();
    const j = jobs();
    const r = await createScan(u, aiInput(), deps(u), j.schedule);
    expect(await deleteScan(u, idOf(r), clock, jobs().schedule)).toBe(true);
    await j.runAll();
    expect(store.keys()).toEqual([]);
    expect(await rowOf(idOf(r))).toMatchObject({ photoCount: 0 });
  });
});

describe("scan photos: URLs", () => {
  it("getScan signs the display copies and the thumbnail (10 min); listScans the thumbnail", async () => {
    const u = await createUser();
    const id = await scanWithPhotos(u);
    const view = await getScan(u, id, clock);
    expect(view!.photoUrls).toEqual([
      `${FAKE_PHOTO_HOST}/display/u/${u}/${id}/1.webp?ttl=600`,
      `${FAKE_PHOTO_HOST}/display/u/${u}/${id}/2.webp?ttl=600`,
    ]);
    expect(view!.thumbnailUrl).toBe(`${FAKE_PHOTO_HOST}/thumb/u/${u}/${id}.webp?ttl=600`);
    const { scans } = await listScans(u, {}, clock);
    expect(scans[0]).toMatchObject({ id, thumbnailUrl: `${FAKE_PHOTO_HOST}/thumb/u/${u}/${id}.webp?ttl=600` });
    expect(scans[0]).not.toHaveProperty("thumbnailKey");
  });

  it("expired photos come back empty; the thumbnail stays", async () => {
    const u = await createUser();
    const id = await scanWithPhotos(u);
    clock = T0 + 30 * DAY - 1;
    expect((await getScan(u, id, clock))!.photoUrls).toHaveLength(2);
    clock = T0 + 30 * DAY;
    const view = await getScan(u, id, clock);
    expect(view!.photoUrls).toEqual([]);
    expect(view!.thumbnailUrl).not.toBeNull();
  });

  it("a scan without photos (barcode not found) has empty URLs", async () => {
    const u = await createUser();
    const j = jobs();
    const r = await createScan(u, { images: [], barcode: "4006381333931" }, deps(u), j.schedule);
    expect(await getScan(u, idOf(r), clock)).toMatchObject({ photoUrls: [], thumbnailUrl: null });
  });
});

describe("scan photos: deletion", () => {
  it("soft delete removes the scan's objects (after the delete), and only that scan's", async () => {
    const u = await createUser();
    const a = await scanWithPhotos(u);
    const b = await scanWithPhotos(u);
    expect(store.keys()).toHaveLength(6);
    const j = jobs();
    expect(await deleteScan(u, a, clock, j.schedule)).toBe(true);
    expect(store.keys()).toHaveLength(6); // deferred to after()
    await j.runAll();
    expect(store.keys()).toEqual([`display/u/${u}/${b}/1.webp`, `display/u/${u}/${b}/2.webp`, `thumb/u/${u}/${b}.webp`]);
  });

  it("account deletion removes both of the user's prefixes, and nobody else's", async () => {
    const u = await createUser();
    const other = await createUser();
    await scanWithPhotos(u);
    await scanWithPhotos(u, [PHOTO]);
    const kept = await scanWithPhotos(other, [PHOTO]);
    await deleteAccount(u);
    expect(store.keys()).toEqual([`display/u/${other}/${kept}/1.webp`, `thumb/u/${other}/${kept}.webp`]);
  });

  it("account deletion sweeps again after the commit, catching a thumbnail put in the meantime", async () => {
    const u = await createUser();
    await scanWithPhotos(u);
    const sweep = store.deletePrefix.bind(store);
    let calls = 0;
    store.deletePrefix = async (prefix) => {
      await sweep(prefix);
      // An in-flight job uploads a thumbnail right after the first sweep of the thumb/ prefix.
      if (++calls === 2) await store.put(`thumb/u/${u}/late.webp`, new Uint8Array([1]), "image/webp");
    };
    await deleteAccount(u);
    expect(calls).toBe(4);
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

describe("scan photos: storage off", () => {
  it("no upload, empty URLs and an unchanged charge", async () => {
    setPhotoStoreForTests(null);
    const u = await createUser();
    const id = await scanWithPhotos(u);
    expect(store.keys()).toEqual([]);
    expect(await rowOf(id)).toMatchObject({ status: "done", charged: true, photoCount: 0, thumbnailKey: null, photosExpireAt: null });
    expect(await getScan(u, id, clock)).toMatchObject({ photoUrls: [], thumbnailUrl: null });
    expect((await listScans(u, {}, clock)).scans[0]!.thumbnailUrl).toBeNull();
    expect(await credits(u)).toBe(19);
    expect(await debits(u)).toHaveLength(1);
    expect(await deleteScan(u, id, clock, jobs().schedule)).toBe(true);
    await deleteAccount(u);
  });
});
