// Shared "read image files off disk into EngineImage[]" helper for the two local-file CLIs that
// drive the engine's extract() directly: scripts/scan-try.ts (one real scan) and eval/run.ts (a
// fixture suite). Node-only (uses node:fs) — never imported by engine code that runs in a request.
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import type { EngineImage } from "./schema";

const MIME_BY_EXT: Record<string, EngineImage["mime"]> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export function mimeFor(path: string): EngineImage["mime"] {
  const mime = MIME_BY_EXT[extname(path).toLowerCase()];
  if (!mime) throw new Error(`unsupported image extension: ${path} (expected .jpg/.jpeg/.png/.webp)`);
  return mime;
}

export function loadImages(paths: string[]): EngineImage[] {
  return paths.map((path) => ({ mime: mimeFor(path), data: new Uint8Array(readFileSync(path)) }));
}
