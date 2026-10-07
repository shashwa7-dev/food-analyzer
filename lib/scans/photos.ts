// Scan photo processing (spec §A Processing): a 1080 px long-edge WebP display copy per photo and one
// 320 px thumbnail from the first. EXIF orientation is applied first; sharp then writes no metadata at
// all (no EXIF, no GPS, no ICC), since nothing here asks it to keep any. Never upscales. Full-size
// originals are never stored. Only bytes that already passed lib/scans/upload.ts's checks come here.
import sharp, { type OutputInfo } from "sharp";

export const DISPLAY_EDGE = 1080;
export const THUMB_EDGE = 320;
/** Size aims, not caps: quality steps down until a copy fits or the floor is reached. */
export const DISPLAY_TARGET_BYTES = 250_000;
export const THUMB_TARGET_BYTES = 40_000;
const DISPLAY_QUALITIES = [70, 60, 50];
const THUMB_QUALITIES = [65, 55, 45];
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
 * Encodes one size from the decoded pixels, stepping quality down until it fits the aim (or the floor).
 * `raw` is already upright and at most DISPLAY_EDGE on its long edge.
 */
async function encode(raw: { data: Buffer; info: OutputInfo }, edge: number, qualities: number[], target: number): Promise<Buffer> {
  const { width, height, channels } = raw.info;
  let out: Buffer | null = null;
  for (const quality of qualities) {
    out = await sharp(raw.data, { raw: { width, height, channels: channels as 1 | 2 | 3 | 4 } })
      .resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true })
      .webp({ quality, effort: 4 })
      .toBuffer();
    if (out.length <= target) break;
  }
  return out!;
}

/**
 * One photo's display copy and, unless `thumb: false`, its thumbnail. The input is decoded once: rotated
 * upright and shrunk to the display size as raw pixels (which carry no metadata), and both outputs are
 * encoded from those. Throws on undecodable bytes.
 */
export async function processPhoto(bytes: Uint8Array, opts: { thumb?: boolean } = {}): Promise<{ display: Buffer; thumb?: Buffer }> {
  const raw = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
    .rotate() // apply the EXIF orientation; the raw pixels carry none
    .resize({ width: DISPLAY_EDGE, height: DISPLAY_EDGE, fit: "inside", withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const display = await encode(raw, DISPLAY_EDGE, DISPLAY_QUALITIES, DISPLAY_TARGET_BYTES);
  if (opts.thumb === false) return { display };
  return { display, thumb: await encode(raw, THUMB_EDGE, THUMB_QUALITIES, THUMB_TARGET_BYTES) };
}
