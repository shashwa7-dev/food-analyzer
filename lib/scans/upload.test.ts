import { describe, expect, it } from "vitest";
import { MAX_BODY_BYTES, MAX_IMAGE_BYTES, parseScanForm, readScanRequest, sniffImageMime } from "./upload";

const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];
const VALID_EAN13 = "8901491101837";

function bytes(header: number[], size = 64): Uint8Array {
  const out = new Uint8Array(Math.max(size, header.length));
  out.set(header);
  return out;
}

function file(data: Uint8Array, type = "image/jpeg", name = "photo.jpg"): File {
  return new File([data as BlobPart], name, { type });
}

function form(entries: [string, string | File][]): FormData {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
}

describe("sniffImageMime", () => {
  it("recognises JPEG, PNG and WebP by magic bytes", () => {
    expect(sniffImageMime(bytes(JPEG))).toBe("image/jpeg");
    expect(sniffImageMime(bytes(PNG))).toBe("image/png");
    expect(sniffImageMime(bytes(WEBP))).toBe("image/webp");
  });
  it("rejects anything else, including RIFF that is not WEBP and truncated headers", () => {
    expect(sniffImageMime(bytes([0x47, 0x49, 0x46, 0x38]))).toBeNull(); // GIF
    expect(sniffImageMime(bytes([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20]))).toBeNull(); // RIFF AVI
    expect(sniffImageMime(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(sniffImageMime(new Uint8Array([]))).toBeNull();
  });
});

describe("parseScanForm", () => {
  it("accepts 1–3 images under field `images`, typed by magic bytes not the claimed MIME", async () => {
    const out = await parseScanForm(form([
      ["images", file(bytes(PNG), "image/jpeg")],
      ["images", file(bytes(WEBP), "application/octet-stream")],
      ["images", file(bytes(JPEG))],
    ]));
    expect("error" in out).toBe(false);
    if ("error" in out) return;
    expect(out.images.map((i) => i.mime)).toEqual(["image/png", "image/webp", "image/jpeg"]);
    expect(out.images[0]!.data).toBeInstanceOf(Uint8Array);
    expect(out.images[0]!.data.length).toBe(64);
    expect(out.barcode).toBeNull();
  });

  it("accepts a barcode alone and normalises it (trims, validates the check digit)", async () => {
    const out = await parseScanForm(form([["barcode", ` ${VALID_EAN13} `]]));
    expect(out).toEqual({ images: [], barcode: VALID_EAN13 });
  });

  it("accepts a barcode with images", async () => {
    const out = await parseScanForm(form([["barcode", VALID_EAN13], ["images", file(bytes(JPEG))]]));
    expect("error" in out ? out : out.barcode).toBe(VALID_EAN13);
  });

  it("rejects a barcode with a wrong check digit or non-digits", async () => {
    expect(await parseScanForm(form([["barcode", "8901491101838"]]))).toEqual({ error: "INVALID_INPUT" });
    expect(await parseScanForm(form([["barcode", "abc"]]))).toEqual({ error: "INVALID_INPUT" });
  });

  it("rejects a form with neither images nor barcode (an empty barcode counts as none)", async () => {
    expect(await parseScanForm(form([]))).toEqual({ error: "INVALID_INPUT" });
    expect(await parseScanForm(form([["barcode", ""]]))).toEqual({ error: "INVALID_INPUT" });
  });

  it("rejects more than 3 images", async () => {
    const f = form(Array.from({ length: 4 }, () => ["images", file(bytes(JPEG))] as [string, File]));
    expect(await parseScanForm(f)).toEqual({ error: "INVALID_INPUT" });
  });

  it("rejects an image whose bytes are not JPEG/PNG/WebP even if it claims to be", async () => {
    expect(await parseScanForm(form([["images", file(bytes([0x47, 0x49, 0x46, 0x38]), "image/jpeg")]]))).toEqual({ error: "INVALID_INPUT" });
  });

  it("rejects an empty file and a string sent under `images`", async () => {
    expect(await parseScanForm(form([["images", file(new Uint8Array(0))]]))).toEqual({ error: "INVALID_INPUT" });
    expect(await parseScanForm(form([["images", "not a file"]]))).toEqual({ error: "INVALID_INPUT" });
  });

  it("rejects a file sent as the barcode", async () => {
    expect(await parseScanForm(form([["barcode", file(bytes(JPEG))]]))).toEqual({ error: "INVALID_INPUT" });
  });

  it("caps each image at 1.2 MB (TOO_LARGE), allowing exactly the cap", async () => {
    expect("error" in (await parseScanForm(form([["images", file(bytes(JPEG, MAX_IMAGE_BYTES))]])))).toBe(false);
    expect(await parseScanForm(form([["images", file(bytes(JPEG, MAX_IMAGE_BYTES + 1))]]))).toEqual({ error: "TOO_LARGE" });
  });

  it("caps the images' total (TOO_LARGE)", async () => {
    // With the real constants 3 × 1.2 MB fits under 4 MB (the per-image cap normally binds and the
    // route's body cap covers multipart overhead), so exercise the total cap with smaller limits.
    expect(MAX_IMAGE_BYTES * 3).toBeLessThanOrEqual(MAX_BODY_BYTES);
    const limits = { maxImageBytes: 100, maxTotalBytes: 150 };
    const two = form([["images", file(bytes(JPEG, 80))], ["images", file(bytes(JPEG, 80))]]);
    expect(await parseScanForm(two, limits)).toEqual({ error: "TOO_LARGE" });
    const ok = form([["images", file(bytes(JPEG, 75))], ["images", file(bytes(JPEG, 75))]]);
    expect("error" in (await parseScanForm(ok, limits))).toBe(false);
  });

  it("ignores unknown fields (e.g. a thumbnail — not stored in M2)", async () => {
    const out = await parseScanForm(form([["images", file(bytes(JPEG))], ["thumbnail", file(bytes(WEBP))], ["x", "y"]]));
    expect("error" in out ? out : out.images.length).toBe(1);
  });
});

describe("readScanRequest", () => {
  const multipart = async (f: FormData) => {
    const r = new Request("http://x/api/v1/scans", { method: "POST", body: f });
    const buf = new Uint8Array(await r.arrayBuffer());
    return { buf, type: r.headers.get("content-type")! };
  };
  const req = (buf: Uint8Array | string, headers: Record<string, string>) =>
    new Request("http://x/api/v1/scans", { method: "POST", body: buf as BodyInit, headers });

  it("reads a multipart body into FormData", async () => {
    const { buf, type } = await multipart(form([["barcode", VALID_EAN13], ["images", file(bytes(JPEG))]]));
    const out = await readScanRequest(req(buf, { "content-type": type, "content-length": String(buf.length) }));
    expect("form" in out).toBe(true);
    if (!("form" in out)) return;
    expect(out.form.get("barcode")).toBe(VALID_EAN13);
    expect(out.form.getAll("images")).toHaveLength(1);
  });

  it("411 without content-length, 400 for a malformed one, 413 when it declares more than 4 MB", async () => {
    const { buf, type } = await multipart(form([["barcode", VALID_EAN13]]));
    expect(await readScanRequest(req(buf, { "content-type": type }))).toEqual({ status: 411, error: "INVALID_INPUT" });
    expect(await readScanRequest(req(buf, { "content-type": type, "content-length": "12abc" }))).toEqual({ status: 400, error: "INVALID_INPUT" });
    expect(await readScanRequest(req(buf, { "content-type": type, "content-length": String(MAX_BODY_BYTES + 1) }))).toEqual({ status: 413, error: "TOO_LARGE" });
  });

  it("413 when the body is larger than the cap even if content-length lies", async () => {
    const { buf, type } = await multipart(form([["images", file(bytes(JPEG, 500))]]));
    expect(await readScanRequest(req(buf, { "content-type": type, "content-length": "10" }), 100)).toEqual({ status: 413, error: "TOO_LARGE" });
  });

  it("400 when the body is not valid multipart", async () => {
    expect(await readScanRequest(req("hello", { "content-type": "multipart/form-data; boundary=zzz", "content-length": "5" }))).toEqual({ status: 400, error: "INVALID_INPUT" });
    expect(await readScanRequest(req("{}", { "content-type": "application/json", "content-length": "2" }))).toEqual({ status: 400, error: "INVALID_INPUT" });
  });
});
