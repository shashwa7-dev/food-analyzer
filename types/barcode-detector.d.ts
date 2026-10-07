// Shape Detection API (https://wicg.github.io/shape-detection-api/#barcode-detection-api) — not in
// TypeScript's DOM lib yet. Only present in some browsers (Chrome on Android/macOS); always feature-
// detect with `"BarcodeDetector" in window` and getSupportedFormats() before use.
export {};

declare global {
  type BarcodeFormat =
    | "aztec" | "code_128" | "code_39" | "code_93" | "codabar" | "data_matrix" | "ean_13" | "ean_8"
    | "itf" | "pdf417" | "qr_code" | "upc_a" | "upc_e" | "unknown";

  interface DetectedBarcode {
    readonly boundingBox: DOMRectReadOnly;
    readonly cornerPoints: ReadonlyArray<{ x: number; y: number }>;
    readonly format: BarcodeFormat;
    readonly rawValue: string;
  }

  interface BarcodeDetectorOptions {
    formats?: BarcodeFormat[];
  }

  class BarcodeDetector {
    constructor(options?: BarcodeDetectorOptions);
    static getSupportedFormats(): Promise<BarcodeFormat[]>;
    detect(image: ImageBitmapSource): Promise<DetectedBarcode[]>;
  }

  interface Window {
    BarcodeDetector?: typeof BarcodeDetector;
  }
}
