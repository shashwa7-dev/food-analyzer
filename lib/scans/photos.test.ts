import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { fitLongEdge, processPhoto, THUMB_EDGE, THUMB_TARGET_BYTES } from "./photos";

// 1600 × 1200 JPEG, EXIF orientation 6 (stored sideways), camera make/model and a GPS position.
const FIXTURE = new Uint8Array(readFileSync(join(__dirname, "__fixtures__/exif-gps.jpg")));

/** The GPS IFD pointer tag (0x8825) in a little-endian EXIF block. */
const hasGpsPointer = (exif: Buffer) => exif.includes(Buffer.from([0x25, 0x88]));

describe("fitLongEdge", () => {
  it("scales the long edge down to the limit, keeping the aspect", () => {
    expect(fitLongEdge(4000, 3000, THUMB_EDGE)).toEqual({ width: 480, height: 360 });
    expect(fitLongEdge(3000, 4000, THUMB_EDGE)).toEqual({ width: 360, height: 480 });
  });
  it("never upscales", () => {
    expect(fitLongEdge(400, 300, THUMB_EDGE)).toEqual({ width: 400, height: 300 });
    expect(fitLongEdge(480, 200, THUMB_EDGE)).toEqual({ width: 480, height: 200 });
  });
});

describe("processPhoto", () => {
  it("the fixture really carries EXIF, GPS and a rotation", async () => {
    const m = await sharp(FIXTURE).metadata();
    expect(m.format).toBe("jpeg");
    expect(m.orientation).toBe(6);
    expect(m.exif && hasGpsPointer(m.exif)).toBe(true);
  });

  it("writes one WebP: rotated upright, long edge 480, no metadata at all", async () => {
    const out = await processPhoto(FIXTURE);
    const m = await sharp(out).metadata();
    expect(m.format).toBe("webp");
    // 1600 x 1200 stored, orientation 6 -> upright 1200 x 1600 -> fit to 360 x 480.
    expect([m.width, m.height]).toEqual([360, 480]);
    expect(m.exif).toBeUndefined();
    expect(m.xmp).toBeUndefined();
    expect(m.icc).toBeUndefined();
    expect(m.orientation).toBeUndefined();
    expect(out.length).toBeLessThanOrEqual(THUMB_TARGET_BYTES);
    expect(out.includes(Buffer.from("TestCam"))).toBe(false);
  });

  it("never upscales a small photo", async () => {
    const small = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#7a9" } }).png().toBuffer();
    const m = await sharp(await processPhoto(new Uint8Array(small))).metadata();
    expect([m.width, m.height]).toEqual([400, 300]);
  });

  it("refuses an input over 50 megapixels", async () => {
    const big = await sharp({ create: { width: 8000, height: 6500, channels: 3, background: "#fff" } }).png({ compressionLevel: 9 }).toBuffer();
    await expect(processPhoto(new Uint8Array(big))).rejects.toThrow();
  });

  it("throws on bytes that are not an image", async () => {
    await expect(processPhoto(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]))).rejects.toThrow();
  });
});
