// R2 object keys for scan photos (spec §A Keys). Two top-level prefixes on purpose: the bucket's
// lifecycle rule (scripts/r2-lifecycle.ts) expires everything under `display/` after 30 days, and the
// thumbnails under `thumb/` stay until the scan (or the account) is deleted.

export const DISPLAY_PREFIX = "display/";
/** Display copies are kept this long: the `display/` lifecycle rule, and scan.photos_expire_at. */
export const PHOTO_RETENTION_DAYS = 30;
export const THUMB_PREFIX = "thumb/";

export const photoKeys = {
  /** The n-th display copy (1-based) of a scan's photos. */
  display: (userId: string, scanId: string, n: number) => `${DISPLAY_PREFIX}u/${userId}/${scanId}/${n}.webp`,
  /** The scan's one thumbnail, from its first photo. */
  thumb: (userId: string, scanId: string) => `${THUMB_PREFIX}u/${userId}/${scanId}.webp`,
  /** Every display copy of one scan. */
  scanDisplayPrefix: (userId: string, scanId: string) => `${DISPLAY_PREFIX}u/${userId}/${scanId}/`,
  /** Everything a user owns: account deletion removes both. */
  userPrefixes: (userId: string): [string, string] => [`${DISPLAY_PREFIX}u/${userId}/`, `${THUMB_PREFIX}u/${userId}/`],
};
