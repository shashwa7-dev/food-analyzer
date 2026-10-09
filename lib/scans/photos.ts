// Scan image processing: each successful photo scan keeps ONE image, made from its first photo: a
// 480 px long-edge WebP. EXIF orientation is applied first; sharp then writes no metadata at all (no
// EXIF, no GPS, no ICC). Never upscales. Full-size originals are never stored. Only bytes that already
// passed lib/scans/upload.ts's checks come here.
import sharp from "sharp";

export const THUMB_EDGE = 480;
/** A size aim, not a cap: quality steps down until the image fits or the floor is reached. */
export const THUMB_TARGET_BYTES = 50_000;
const THUMB_QUALITIES = [70, 60, 50, 40];
/** Decompression-bomb guard: a 1.2 MB upload has no business decoding to more than this. */
const MAX_INPUT_PIXELS = 50_000_000;

/** The long edge after a never-upscaling "fit inside edge × edge" resize. */
export function fitLongEdge(width: number, height: number, edge: number): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= edge) return { width, height };
  const k = edge / long;
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

/**
 * The scan's one stored image, from its first photo: rotated upright, shrunk to THUMB_EDGE on the long
 * edge (never enlarged) and encoded as WebP, quality stepping down until it fits the target (or the
 * floor). sharp is not asked to keep any metadata. Throws on undecodable or oversized-pixel input.
 */
export async function processPhoto(bytes: Uint8Array): Promise<Buffer> {
  const raw = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
    .rotate() // apply the EXIF orientation; the raw pixels carry none
    .resize({ width: THUMB_EDGE, height: THUMB_EDGE, fit: "inside", withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = raw.info;
  let out: Buffer | null = null;
  for (const quality of THUMB_QUALITIES) {
    out = await sharp(raw.data, { raw: { width, height, channels: channels as 1 | 2 | 3 | 4 } }).webp({ quality, effort: 4 }).toBuffer();
    if (out.length <= THUMB_TARGET_BYTES) break;
  }
  return out!;
}
