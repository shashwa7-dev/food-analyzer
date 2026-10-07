// Barcode decoding on the scan screen. Uses the browser's BarcodeDetector when it supports EAN-13,
// otherwise lazily loads zxing-wasm (only ever imported from /scan, so no other page pays for it; the
// wasm binary comes from zxing-wasm's default CDN — see README). Never throws: a reader that can't
// start or a frame that can't be decoded just reads as "no barcode".
import { normaliseBarcode } from "@/lib/engine/barcode";

/** The first raw value that is a valid EAN-8 / EAN-13 / UPC-A (normalised: UPC-A → EAN-13), else null. */
export function pickBarcode(rawValues: readonly string[]): string | null {
  for (const raw of rawValues) {
    const code = normaliseBarcode(raw);
    if (code) return code;
  }
  return null;
}

export interface BarcodeReader {
  read(canvas: HTMLCanvasElement): Promise<string | null>;
}

const NATIVE_FORMATS: BarcodeFormat[] = ["ean_13", "ean_8", "upc_a"];

async function nativeReader(): Promise<BarcodeReader | null> {
  if (typeof window === "undefined" || !("BarcodeDetector" in window) || !window.BarcodeDetector) return null;
  try {
    const supported = await window.BarcodeDetector.getSupportedFormats();
    if (!supported.includes("ean_13")) return null;
    const detector = new window.BarcodeDetector({ formats: NATIVE_FORMATS.filter((f) => supported.includes(f)) });
    return {
      async read(canvas) {
        try {
          return pickBarcode((await detector.detect(canvas)).map((d) => d.rawValue));
        } catch {
          return null;
        }
      },
    };
  } catch {
    return null;
  }
}

async function zxingReader(): Promise<BarcodeReader | null> {
  try {
    const { readBarcodes, prepareZXingModule } = await import("zxing-wasm/reader");
    await prepareZXingModule({ fireImmediately: true }); // fetch + compile the wasm now, not on the first frame
    return {
      async read(canvas) {
        try {
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return null;
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const results = await readBarcodes(image, { formats: ["EAN13", "EAN8", "UPCA"], maxNumberOfSymbols: 1 });
          return pickBarcode(results.filter((r) => r.isValid).map((r) => r.text));
        } catch {
          return null;
        }
      },
    };
  } catch {
    return null;
  }
}

const NONE: BarcodeReader = { read: async () => null };
let reader: Promise<BarcodeReader> | null = null;

/** One shared reader per page load (native if possible, else zxing, else a no-op). */
export function getBarcodeReader(): Promise<BarcodeReader> {
  reader ??= (async () => (await nativeReader()) ?? (await zxingReader()) ?? NONE)();
  return reader;
}
