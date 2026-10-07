import { afterEach, describe, expect, it } from "vitest";
import { createFakeStore } from "./fake";
import { deleteObjectsBody, getPhotoStore, parseListPage, setPhotoStoreForTests } from "./r2";

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
    const xml = `<ListBucketResult><IsTruncated>true</IsTruncated><Contents><Key>display/u/u1/a&amp;b/1.webp</Key></Contents><Contents><Key>thumb/u/u1/s.webp</Key></Contents><NextContinuationToken>t1</NextContinuationToken></ListBucketResult>`;
    expect(parseListPage(xml)).toEqual({ keys: ["display/u/u1/a&b/1.webp", "thumb/u/u1/s.webp"], next: "t1" });
    expect(parseListPage("<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>")).toEqual({ keys: [], next: null });
  });
  it("escapes keys in a DeleteObjects body", () => {
    expect(deleteObjectsBody(["a&b"])).toContain("<Object><Key>a&amp;b</Key></Object>");
  });
});
