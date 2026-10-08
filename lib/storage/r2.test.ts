import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeStore } from "./fake";
import { createR2Store, deleteObjectsBody, getPhotoStore, MAX_PREFIX_ROUNDS, parseDeleteErrors, parseListPage, setPhotoStoreForTests } from "./r2";

const R2 = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"] as const;

describe("getPhotoStore", () => {
  const saved = Object.fromEntries(R2.map((k) => [k, process.env[k]]));
  afterEach(() => {
    for (const k of R2) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    setPhotoStoreForTests(undefined);
  });

  it("is off (null) unless all four R2 values are set", () => {
    for (const k of R2) delete process.env[k];
    expect(getPhotoStore()).toBeNull();
    process.env.R2_ACCOUNT_ID = "acc";
    process.env.R2_ACCESS_KEY_ID = "key";
    process.env.R2_SECRET_ACCESS_KEY = "secret";
    expect(getPhotoStore()).toBeNull();
    process.env.R2_BUCKET = "eatri8-photos";
    expect(getPhotoStore()).not.toBeNull();
  });

  it("signs a GET URL locally, with the TTL and no network", async () => {
    Object.assign(process.env, { R2_ACCOUNT_ID: "acc", R2_ACCESS_KEY_ID: "key", R2_SECRET_ACCESS_KEY: "secret", R2_BUCKET: "eatri8-photos" });
    const url = new URL(await getPhotoStore()!.signedGetUrl("thumb/u/u1/s1.webp", 600));
    expect(url.origin).toBe("https://acc.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/eatri8-photos/thumb/u/u1/s1.webp");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("600");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("uses the test override when one is set", () => {
    const fake = createFakeStore();
    setPhotoStoreForTests(fake);
    expect(getPhotoStore()).toBe(fake);
    setPhotoStoreForTests(null);
    expect(getPhotoStore()).toBeNull();
  });
});

describe("S3 XML", () => {
  it("reads a ListObjectsV2 page", () => {
    const xml = `<ListBucketResult><IsTruncated>true</IsTruncated><Contents><Key>thumb/u/u1/a&amp;b/1.webp</Key></Contents><Contents><Key>thumb/u/u1/s.webp</Key></Contents><NextContinuationToken>t1</NextContinuationToken></ListBucketResult>`;
    expect(parseListPage(xml)).toEqual({ keys: ["thumb/u/u1/a&b/1.webp", "thumb/u/u1/s.webp"], next: "t1" });
    expect(parseListPage("<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>")).toEqual({ keys: [], next: null });
  });
  it("escapes keys in a DeleteObjects body", () => {
    expect(deleteObjectsBody(["a&b"])).toContain("<Object><Key>a&amp;b</Key></Object>");
  });
});

describe("R2 store against a fake fetch", () => {
  const cfg = { accountId: "acc", accessKeyId: "key", secretAccessKey: "secret", bucket: "b" };
  afterEach(() => vi.unstubAllGlobals());

  /** A tiny R2: ListObjectsV2 (≤ 1000 a page, truncated beyond) and DeleteObjects; keys in `stuck` never delete. */
  function fakeR2(keys: string[], stuck: Set<string> = new Set()) {
    const objects = new Set(keys);
    const calls = { list: 0, delete: 0 };
    vi.stubGlobal("fetch", vi.fn(async (req: Request) => {
      const url = new URL(req.url);
      if (req.method === "GET" && url.searchParams.get("list-type") === "2") {
        calls.list++;
        const all = [...objects].filter((k) => k.startsWith(url.searchParams.get("prefix") ?? "")).sort();
        const page = all.slice(0, 1000);
        return new Response(`<ListBucketResult><IsTruncated>${all.length > 1000}</IsTruncated>${page.map((k) => `<Contents><Key>${k}</Key></Contents>`).join("")}${all.length > 1000 ? "<NextContinuationToken>t</NextContinuationToken>" : ""}</ListBucketResult>`);
      }
      if (req.method === "POST" && url.searchParams.has("delete")) {
        calls.delete++;
        const asked = [...(await req.text()).matchAll(/<Key>(.*?)<\/Key>/g)].map((m) => m[1]!);
        const failed = asked.filter((k) => stuck.has(k));
        for (const k of asked) if (!stuck.has(k)) objects.delete(k);
        return new Response(`<DeleteResult>${failed.map((k) => `<Error><Key>${k}</Key><Code>InternalError</Code><Message>x</Message></Error>`).join("")}</DeleteResult>`);
      }
      return new Response("unexpected", { status: 500 });
    }));
    return { objects, calls };
  }

  it("reads the <Error> entries of a quiet DeleteObjects response", () => {
    expect(parseDeleteErrors("<DeleteResult/>")).toEqual([]);
    expect(parseDeleteErrors("<DeleteResult><Error><Key>a&amp;b</Key><Code>AccessDenied</Code></Error></DeleteResult>")).toEqual([{ key: "a&b", code: "AccessDenied" }]);
  });

  it("deletes every key under a prefix, page by page", async () => {
    const keys = Array.from({ length: 2500 }, (_, i) => `thumb/u/u1/s${i}/1.webp`);
    const r2 = fakeR2([...keys, "display/u/u2/s/1.webp"]);
    await createR2Store(cfg).deletePrefix("thumb/u/u1/");
    expect([...r2.objects]).toEqual(["display/u/u2/s/1.webp"]);
    expect(r2.calls.delete).toBe(3);
  });

  it("throws when a 200 DeleteObjects reports per-key errors", async () => {
    fakeR2(["thumb/u/u1/a.webp", "thumb/u/u1/b.webp"], new Set(["thumb/u/u1/b.webp"]));
    await expect(createR2Store(cfg).deleteKeys(["thumb/u/u1/a.webp", "thumb/u/u1/b.webp"])).rejects.toThrow(/1 key\(s\): thumb\/u\/u1\/b.webp \(InternalError\)/);
  });

  it("deletePrefix stops on partial failures instead of re-listing forever", async () => {
    const keys = Array.from({ length: 1500 }, (_, i) => `thumb/u/u1/s${i}/1.webp`);
    const r2 = fakeR2(keys, new Set(keys.slice(0, 1000)));
    await expect(createR2Store(cfg).deletePrefix("thumb/u/u1/")).rejects.toThrow(/DeleteObjects failed for \d+ key/);
    expect(r2.calls.list).toBe(1);
  });

  it("deletePrefix gives up after a bounded number of rounds", async () => {
    // A listing that never empties although each delete reports success (eventual consistency gone wrong).
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async (req: Request) => {
      const url = new URL(req.url);
      if (url.searchParams.get("list-type") === "2") {
        n++;
        return new Response(`<ListBucketResult><IsTruncated>true</IsTruncated>${Array.from({ length: 1000 }, (_, i) => `<Contents><Key>thumb/u/u1/${n}-${i}</Key></Contents>`).join("")}<NextContinuationToken>t</NextContinuationToken></ListBucketResult>`);
      }
      return new Response("<DeleteResult></DeleteResult>");
    }));
    await expect(createR2Store(cfg).deletePrefix("thumb/u/u1/")).rejects.toThrow(`after ${MAX_PREFIX_ROUNDS} rounds`);
    expect(n).toBe(MAX_PREFIX_ROUNDS);
  });
});
