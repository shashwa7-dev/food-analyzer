import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { DISPLAY_TARGET_BYTES, fitLongEdge, processPhoto, THUMB_TARGET_BYTES } from "./photos";

// 1600 × 1200 JPEG, EXIF orientation 6 (stored sideways), camera make/model and a GPS position.
const FIXTURE = new Uint8Array(readFileSync(join(__dirname, "__fixtures__/exif-gps.jpg")));

/** The GPS IFD pointer tag (0x8825) in a little-endian EXIF block. */
const hasGpsPointer = (exif: Buffer) => exif.includes(Buffer.from([0x25, 0x88]));

describe("fitLongEdge", () => {
  it("scales the long edge down to the limit, keeping the aspect", () => {
    expect(fitLongEdge(4000, 3000, 1080)).toEqual({ width: 1080, height: 810 });
    expect(fitLongEdge(3000, 4000, 320)).toEqual({ width: 240, height: 320 });
  });
  it("never upscales", () => {
    expect(fitLongEdge(800, 600, 1080)).toEqual({ width: 800, height: 600 });
    expect(fitLongEdge(1080, 200, 1080)).toEqual({ width: 1080, height: 200 });
  });
});

describe("processPhoto", () => {
  it("the fixture really carries EXIF, GPS and a rotation", async () => {
    const m = await sharp(FIXTURE).metadata();
    expect(m.format).toBe("jpeg");
    expect(m.orientation).toBe(6);
    expect(m.exif && hasGpsPointer(m.exif)).toBe(true);
  });

  it("writes a WebP display copy: rotated upright, long edge 1080, no metadata at all", async () => {
    const { display } = await processPhoto(FIXTURE);
    const m = await sharp(display).metadata();
    expect(m.format).toBe("webp");
    // 1600 × 1200 stored, orientation 6 → upright 1200 × 1600 → fit to 810 × 1080.
    expect([m.width, m.height]).toEqual([810, 1080]);
    expect(m.exif).toBeUndefined();
    expect(m.xmp).toBeUndefined();
    expect(m.icc).toBeUndefined();
    expect(m.orientation).toBeUndefined();
    expect(display.length).toBeLessThanOrEqual(DISPLAY_TARGET_BYTES);
    expect(display.includes(Buffer.from("TestCam"))).toBe(false);
  });

  it("writes a 320 px WebP thumbnail with no metadata", async () => {
    const { thumb } = await processPhoto(FIXTURE);
    const m = await sharp(thumb!).metadata();
    expect(m.format).toBe("webp");
    expect(Math.max(m.width!, m.height!)).toBe(320);
    expect(m.exif).toBeUndefined();
    expect(thumb!.length).toBeLessThanOrEqual(THUMB_TARGET_BYTES);
  });

  it("never upscales a small photo, and skips the thumbnail when asked", async () => {
    const small = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#7a9" } }).png().toBuffer();
    const r = await processPhoto(new Uint8Array(small), { thumb: false });
    const m = await sharp(r.display).metadata();
    expect([m.width, m.height]).toEqual([400, 300]);
    expect(r.thumb).toBeUndefined();
  });

  it("throws on bytes that are not an image", async () => {
    await expect(processPhoto(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]))).rejects.toThrow();
  });
});
