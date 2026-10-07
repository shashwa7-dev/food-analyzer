// Scan photos on R2 (spec §A): uploading a scan's processed photos in the post-charge background job,
// recording them on the scan, signing their URLs for the API and deleting them. Every function is a
// no-op when storage is off (getPhotoStore() null), and none of them ever touches a scan's status,
// result or charge: a photo failure is logged and the scan carries on exactly as without storage.
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { scan } from "@/lib/db/schema";
import type { EngineImage } from "@/lib/engine/schema";
import { PHOTO_RETENTION_DAYS, photoKeys } from "@/lib/storage/keys";
import { getPhotoStore, type PhotoStore } from "@/lib/storage/r2";

/** Signed GET URLs live 10 minutes. */
export const PHOTO_URL_TTL_SECONDS = 600;
const DAY_MS = 86_400_000;
const WEBP = "image/webp";

/** `uploadedAt` (epoch ms) starts the 30 days: the lifecycle rule counts from the objects' creation. */
export type UploadedPhotos = { displayKeys: string[]; thumbKey: string | null; uploadedAt: number };

/**
 * Processes and uploads a scan's photos (display copies 1..n, a thumbnail from the first). Never
 * rejects: storage off, no images or any failure resolves null, after removing whatever it put.
 * Only for AI scans, with bytes lib/scans/upload.ts already validated.
 */
export async function uploadScanPhotos(userId: string, scanId: string, images: EngineImage[], now: number): Promise<UploadedPhotos | null> {
  const store = getPhotoStore();
  if (!store || images.length === 0) return null;
  const put: string[] = [];
  try {
    const { processPhoto } = await import("./photos"); // sharp loads only when there is work for it
    const displayKeys: string[] = [];
    let thumbKey: string | null = null;
    for (const [i, img] of images.entries()) {
      const out = await processPhoto(img.data, { thumb: i === 0 });
      const key = photoKeys.display(userId, scanId, i + 1);
      put.push(key);
      await store.put(key, out.display, WEBP);
      displayKeys.push(key);
      if (out.thumb) {
        thumbKey = photoKeys.thumb(userId, scanId);
        put.push(thumbKey);
        await store.put(thumbKey, out.thumb, WEBP);
      }
    }
    return { displayKeys, thumbKey, uploadedAt: now };
  } catch (err) {
    console.error("scan photo upload failed", { scanId, err: err instanceof Error ? err.message : err });
    await deleteQuietly(store, put, scanId);
    return null;
  }
}

/**
 * Records uploaded photos on the scan, once its job has finished: conditional on the scan being done
 * and not deleted, and setting only the photo columns (never the status). A failed, deleted or
 * vanished (account deleted) scan gets no photos, and the objects just uploaded are removed again.
 */
export async function attachScanPhotos(userId: string, scanId: string, photos: UploadedPhotos | null): Promise<void> {
  if (!photos) return;
  const store = getPhotoStore();
  try {
    const rows = await db.update(scan)
      .set({ thumbnailKey: photos.thumbKey, photoCount: photos.displayKeys.length, photosExpireAt: new Date(photos.uploadedAt + PHOTO_RETENTION_DAYS * DAY_MS) })
      .where(and(eq(scan.id, scanId), eq(scan.userId, userId), eq(scan.status, "done"), isNull(scan.deletedAt)))
      .returning({ id: scan.id });
    if (rows.length > 0) return;
  } catch (err) {
    console.error("scan photo record failed", { scanId, err: err instanceof Error ? err.message : err });
  }
  if (store) await deleteQuietly(store, [...photos.displayKeys, ...(photos.thumbKey ? [photos.thumbKey] : [])], scanId);
}

async function deleteQuietly(store: PhotoStore, keys: string[], scanId: string) {
  if (keys.length === 0) return;
  try {
    await store.deleteKeys(keys);
  } catch (err) {
    console.error("scan photo cleanup failed", { scanId, err: err instanceof Error ? err.message : err });
  }
}

type PhotoColumns = { id: string; userId: string; photoCount: number; photosExpireAt: Date | null; thumbnailKey: string | null };

/** The scan's signed display URLs: none when storage is off, there are none, or they have expired. */
export async function signedPhotoUrls(row: PhotoColumns, now: number): Promise<string[]> {
  const store = getPhotoStore();
  if (!store || row.photoCount <= 0 || !row.photosExpireAt || row.photosExpireAt.getTime() <= now) return [];
  return Promise.all(Array.from({ length: row.photoCount }, (_, i) => store.signedGetUrl(photoKeys.display(row.userId, row.id, i + 1), PHOTO_URL_TTL_SECONDS)));
}

/** The scan's signed thumbnail URL, or null (storage off, or no thumbnail). */
export async function signedThumbnailUrl(thumbnailKey: string | null): Promise<string | null> {
  const store = getPhotoStore();
  if (!store || !thumbnailKey) return null;
  return store.signedGetUrl(thumbnailKey, PHOTO_URL_TTL_SECONDS);
}

/** Best-effort removal of one scan's objects (after a soft delete). Never rejects. */
export async function deleteScanPhotos(userId: string, scanId: string): Promise<void> {
  const store = getPhotoStore();
  if (!store) return;
  try {
    await store.deletePrefix(photoKeys.scanDisplayPrefix(userId, scanId));
    await store.deleteKeys([photoKeys.thumb(userId, scanId)]);
  } catch (err) {
    console.error("scan photo delete failed", { scanId, err: err instanceof Error ? err.message : err });
  }
}

/** Removes every photo a user has (both prefixes). Throws on failure, so account deletion can stop and be retried. */
export async function deleteUserPhotos(userId: string): Promise<void> {
  const store = getPhotoStore();
  if (!store) return;
  for (const prefix of photoKeys.userPrefixes(userId)) await store.deletePrefix(prefix);
}
