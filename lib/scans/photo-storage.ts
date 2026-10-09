// The scan's one image on R2: made from its first photo, uploaded only after the scan has succeeded,
// recorded as scan.thumbnail_key, signed for the API and deleted with the scan. Every function is a
// no-op when storage is off (getPhotoStore() null), and none of them ever touches a scan's status,
// result or charge: a photo failure is logged and the scan carries on exactly as without storage.
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { scan } from "@/lib/db/schema";
import type { EngineImage } from "@/lib/engine/schema";
import { photoKeys } from "@/lib/storage/keys";
import { getPhotoStore } from "@/lib/storage/r2";

/** Signed GET URLs live 10 minutes. */
export const PHOTO_URL_TTL_SECONDS = 600;

/**
 * Called after the scan's job has finished. Only a scan that is `done` and not deleted gets an image:
 * the first photo is processed, uploaded, and its key recorded. If recording fails or matches no row
 * (deleted meanwhile), the uploaded object is removed again. Never rejects.
 */
export async function storeScanImage(userId: string, scanId: string, images: EngineImage[]): Promise<void> {
  const store = getPhotoStore();
  const first = images[0];
  if (!store || !first) return;
  let key: string | null = null;
  try {
    const [row] = await db.select({ id: scan.id }).from(scan)
      .where(and(eq(scan.id, scanId), eq(scan.userId, userId), eq(scan.status, "done"), isNull(scan.deletedAt)));
    if (!row) return;
    const { processPhoto } = await import("./photos"); // sharp loads only when there is work for it
    const bytes = await processPhoto(first.data);
    key = photoKeys.thumb(userId, scanId);
    await store.put(key, bytes, "image/webp");
    const rows = await db.update(scan).set({ thumbnailKey: key })
      .where(and(eq(scan.id, scanId), eq(scan.userId, userId), eq(scan.status, "done"), isNull(scan.deletedAt)))
      .returning({ id: scan.id });
    if (rows.length > 0) return;
  } catch (err) {
    console.error("scan image store failed", { scanId, err: err instanceof Error ? err.message : err });
  }
  if (key) {
    try {
      await store.deleteKeys([key]);
    } catch (err) {
      console.error("scan image cleanup failed", { scanId, err: err instanceof Error ? err.message : err });
    }
  }
}

/** The scan's signed image URL, or null (storage off, or no image). */
export async function signedImageUrl(thumbnailKey: string | null): Promise<string | null> {
  const store = getPhotoStore();
  if (!store || !thumbnailKey) return null;
  return store.signedGetUrl(thumbnailKey, PHOTO_URL_TTL_SECONDS);
}

/** Best-effort removal of one scan's image (after a soft delete). Never rejects. */
export async function deleteScanPhotos(userId: string, scanId: string): Promise<void> {
  const store = getPhotoStore();
  if (!store) return;
  try {
    await store.deleteKeys([photoKeys.thumb(userId, scanId)]);
  } catch (err) {
    console.error("scan image delete failed", { scanId, err: err instanceof Error ? err.message : err });
  }
}

/** Removes every image a user has. Throws on failure, so account deletion can stop and be retried. */
export async function deleteUserPhotos(userId: string): Promise<void> {
  const store = getPhotoStore();
  if (!store) return;
  await store.deletePrefix(photoKeys.userPrefix(userId));
}
