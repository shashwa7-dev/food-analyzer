// An in-memory PhotoStore for tests (spec §A Storage). `failPuts` makes every upload throw, to check a
// failed upload never touches the scan or the charge.
import type { PhotoStore } from "./r2";

export const FAKE_PHOTO_HOST = "https://photos.test";

export interface FakePhotoStore extends PhotoStore {
  objects: Map<string, { bytes: Uint8Array; contentType: string }>;
  failPuts: boolean;
  /** Every put attempted, in order, including ones that were later deleted or that failed. */
  puts: string[];
  keys(): string[];
}

export function createFakeStore(): FakePhotoStore {
  const objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
  const store: FakePhotoStore = {
    objects,
    failPuts: false,
    puts: [],
    keys: () => [...objects.keys()].sort(),
    async put(key, bytes, contentType) {
      store.puts.push(key);
      if (store.failPuts) throw new Error("fake store: put failed");
      objects.set(key, { bytes, contentType });
    },
    async signedGetUrl(key, ttlSeconds) {
      return `${FAKE_PHOTO_HOST}/${key}?ttl=${ttlSeconds}`;
    },
    async deletePrefix(prefix) {
      for (const k of [...objects.keys()]) if (k.startsWith(prefix)) objects.delete(k);
    },
    async deleteKeys(keys) {
      for (const k of keys) objects.delete(k);
    },
  };
  return store;
}
