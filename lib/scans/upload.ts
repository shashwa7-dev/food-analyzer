// Multipart scan upload parsing (spec §8 POST /scans). Images are only held in memory for the model
// call (no image storage in M2). Every check here is on the actual bytes, never on the client's
// claimed MIME type or file name.
import { normaliseBarcode } from "@/lib/engine/barcode";
import type { EngineImage } from "@/lib/engine/schema";

export const MAX_IMAGES = 3;
/** Per image. Decimal megabytes (stricter than MiB); the client targets ~400 KB per image. */
export const MAX_IMAGE_BYTES = 1_200_000;
/** Whole request body (Vercel's own limit is 4.5 MB). Also used for the images' total. */
export const MAX_BODY_BYTES = 4_000_000;
const MAX_BARCODE_CHARS = 32;

export type ScanForm = { images: EngineImage[]; barcode: string | null };
export type ScanFormError = { error: "INVALID_INPUT" | "TOO_LARGE" };

const startsWith = (b: Uint8Array, sig: number[], at = 0) => b.length >= at + sig.length && sig.every((v, i) => b[at + i] === v);

/** JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF....WEBP`; anything else → null. */
export function sniffImageMime(b: Uint8Array): EngineImage["mime"] | null {
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

/**
 * Parses the `images` (repeated, 0–3 files) and `barcode` fields. Size caps are checked on the
 * declared Blob size before any bytes are read, then each file's magic bytes are verified. At least
 * one of images/barcode is required; a barcode must pass the EAN-8/EAN-13/UPC-A check digit and is
 * returned normalised (UPC-A → EAN-13). Unknown fields (e.g. a thumbnail) are ignored.
 */
export async function parseScanForm(
  form: FormData,
  limits: { maxImageBytes: number; maxTotalBytes: number } = { maxImageBytes: MAX_IMAGE_BYTES, maxTotalBytes: MAX_BODY_BYTES },
): Promise<ScanForm | ScanFormError> {
  const invalid: ScanFormError = { error: "INVALID_INPUT" };
  const tooLarge: ScanFormError = { error: "TOO_LARGE" };

  const entries = form.getAll("images");
  if (entries.length > MAX_IMAGES) return invalid;
  const files: Blob[] = [];
  for (const e of entries) {
    if (typeof e === "string") return invalid;
    files.push(e);
  }
  if (files.some((f) => f.size > limits.maxImageBytes)) return tooLarge;
  if (files.reduce((s, f) => s + f.size, 0) > limits.maxTotalBytes) return tooLarge;

  const images: EngineImage[] = [];
  for (const f of files) {
    if (f.size === 0) return invalid;
    const data = new Uint8Array(await f.arrayBuffer());
    if (data.length > limits.maxImageBytes) return tooLarge; // never trust the declared size alone
    const mime = sniffImageMime(data);
    if (!mime) return invalid;
    images.push({ mime, data });
  }

  const rawBarcode = form.get("barcode");
  let barcode: string | null = null;
  if (rawBarcode !== null) {
    if (typeof rawBarcode !== "string") return invalid;
    const trimmed = rawBarcode.trim();
    if (trimmed.length > MAX_BARCODE_CHARS) return invalid;
    if (trimmed.length > 0) {
      barcode = normaliseBarcode(trimmed);
      if (!barcode) return invalid;
    }
  }

  if (images.length === 0 && !barcode) return invalid;
  return { images, barcode };
}

export type ScanRequestError = { status: 400 | 411 | 413; error: "INVALID_INPUT" | "TOO_LARGE" };

/** Reads at most `max` bytes of a stream; null as soon as it would exceed `max`. */
async function readCapped(body: ReadableStream<Uint8Array> | null, max: number): Promise<Uint8Array | null> {
  if (!body) return new Uint8Array(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

/**
 * The route's body guard: `content-length` is required (411) and must be ≤ the cap (413) — and since
 * the header can lie, the body itself is read with the same byte cap before multipart parsing.
 * Unparseable multipart → 400.
 */
export async function readScanRequest(req: Request, maxBytes: number = MAX_BODY_BYTES): Promise<{ form: FormData } | ScanRequestError> {
  const len = req.headers.get("content-length");
  if (len === null) return { status: 411, error: "INVALID_INPUT" };
  if (!/^\d{1,15}$/.test(len.trim())) return { status: 400, error: "INVALID_INPUT" };
  if (Number(len) > maxBytes) return { status: 413, error: "TOO_LARGE" };

  let bytes: Uint8Array | null;
  try {
    bytes = await readCapped(req.body, maxBytes);
  } catch {
    return { status: 400, error: "INVALID_INPUT" };
  }
  if (!bytes) return { status: 413, error: "TOO_LARGE" };
  try {
    const form = await new Response(bytes as BodyInit, { headers: { "content-type": req.headers.get("content-type") ?? "" } }).formData();
    return { form };
  } catch {
    return { status: 400, error: "INVALID_INPUT" };
  }
}
