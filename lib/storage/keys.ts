// R2 object keys for scan images (one per scan). Everything lives under `thumb/u/{userId}/`, so deleting
// an account is one prefix sweep and deleting a scan is one key.

export const THUMB_PREFIX = "thumb/";

export const photoKeys = {
  /** The scan's one stored image, made from its first photo. */
  thumb: (userId: string, scanId: string) => `${THUMB_PREFIX}u/${userId}/${scanId}.webp`,
  /** Everything a user owns: account deletion removes it. */
  userPrefix: (userId: string) => `${THUMB_PREFIX}u/${userId}/`,
};
