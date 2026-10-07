// Client-side photo compression for scans: the server takes at most 1.2 MB per image (no image storage
// in M2), so every photo — camera frame or gallery file — is redrawn to a canvas with its long edge
// capped at 1600 px and re-encoded as JPEG. The sizing and quality-retry logic is pure (unit-tested);
// the canvas/createImageBitmap parts only run in the browser.
import { MAX_IMAGE_BYTES } from "@/lib/scans/upload";

export const MAX_EDGE_PX = 1600;
export const QUALITIES = [0.8, 0.65] as const;

export const UNSUPPORTED_PHOTO_MESSAGE = "This photo format isn't supported — take a photo instead.";
export const PHOTO_TOO_LARGE_MESSAGE = "That photo is too large to send. Take a photo instead.";

export class PhotoError extends Error {}

/** Scales (w, h) down so the long edge is at most `maxEdge`; never scales up. Integer, ≥ 1 px. */
export function fitWithin(width: number, height: number, maxEdge: number = MAX_EDGE_PX): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) throw new PhotoError(UNSUPPORTED_PHOTO_MESSAGE);
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Encodes at each quality in turn (0.8, then 0.65) and returns the first blob within `maxBytes`.
 * `encode` returning null (canvas couldn't encode) means the photo is unusable.
 */
export async function encodeWithinBudget(
  encode: (quality: number) => Promise<Blob | null>,
  maxBytes: number = MAX_IMAGE_BYTES,
): Promise<Blob> {
  for (const q of QUALITIES) {
    const blob = await encode(q);
    if (!blob) throw new PhotoError(UNSUPPORTED_PHOTO_MESSAGE);
    if (blob.size <= maxBytes) return blob;
  }
  throw new PhotoError(PHOTO_TOO_LARGE_MESSAGE);
}

export interface CompressedPhoto {
  blob: Blob;
  /** The downscaled frame, kept so the barcode reader can look at the same pixels. */
  canvas: HTMLCanvasElement;
}

/** Draws `source` (a video frame, an ImageBitmap) at ≤ 1600 px and encodes it as JPEG within budget. */
export async function compressSource(source: CanvasImageSource, srcWidth: number, srcHeight: number): Promise<CompressedPhoto> {
  const { width, height } = fitWithin(srcWidth, srcHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PhotoError(UNSUPPORTED_PHOTO_MESSAGE);
  ctx.drawImage(source, 0, 0, width, height);
  const blob = await encodeWithinBudget((q) => new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", q)));
  return { blob, canvas };
}

/**
 * A gallery or `capture` file. HEIC and friends rely on the browser decoding them via
 * createImageBitmap (Safari does); where it can't, the user is told to take a photo instead.
 */
export async function compressFile(file: Blob): Promise<CompressedPhoto> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoError(UNSUPPORTED_PHOTO_MESSAGE);
  }
  try {
    return await compressSource(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}
