// Manual smoke test for the model adapter (lib/engine/model.ts) — `pnpm scan:try <img...>`.
// Not run in CI: it needs a real GOOGLE_GENERATIVE_AI_API_KEY and makes a real network call.
// With no key configured, it prints a clear message and exits 0 (so an accidental CI run, or a
// contributor without a key, doesn't fail a build over this).
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { extract } from "@/lib/engine/model";
import type { EngineImage } from "@/lib/engine/schema";

const MIME_BY_EXT: Record<string, EngineImage["mime"]> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function mimeFor(path: string): EngineImage["mime"] {
  const mime = MIME_BY_EXT[extname(path).toLowerCase()];
  if (!mime) throw new Error(`unsupported image extension: ${path} (expected .jpg/.jpeg/.png/.webp)`);
  return mime;
}

// Checks MODEL_FAST / MODEL_STRONG against the live Gemini models list, so a stale default in
// lib/env.ts (a model Google has retired or renamed) is caught before `extract()` wastes a call.
async function checkLiveModelIds(apiKey: string, fast: string, strong: string) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  if (!res.ok) {
    console.warn(`model list check: GET /v1beta/models failed (${res.status}); skipping the live id check.`);
    return;
  }
  const body = (await res.json()) as { models?: { name?: string }[] };
  const liveIds = new Set((body.models ?? []).map((m) => m.name?.replace(/^models\//, "")).filter((id): id is string => Boolean(id)));
  const flashIds = [...liveIds].filter((id) => id.includes("flash"));

  for (const [label, configured] of [["MODEL_FAST", fast] as const, ["MODEL_STRONG", strong] as const]) {
    if (liveIds.has(configured)) {
      console.log(`${label}=${configured}: OK (found in the live models list)`);
      continue;
    }
    const wantsLite = label === "MODEL_FAST";
    const closest = flashIds.filter((id) => wantsLite === id.includes("lite"));
    console.warn(`${label}=${configured}: NOT found in the live models list.`);
    console.warn(`  closest ${wantsLite ? "flash-lite" : "flash"} id(s): ${closest.length > 0 ? closest.join(", ") : "(none found)"}`);
  }
}

async function main() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    console.log("GOOGLE_GENERATIVE_AI_API_KEY is not set — scan:try has nothing to call. Set it in .env.local to try a real scan.");
    return;
  }

  const fast = process.env.MODEL_FAST?.trim() || "gemini-3.5-flash-lite";
  const strong = process.env.MODEL_STRONG?.trim() || "gemini-3.5-flash";
  await checkLiveModelIds(apiKey, fast, strong);

  const paths = process.argv.slice(2);
  if (paths.length === 0) {
    console.log("\nNo image paths given — pass one or more image files to run a real extraction, e.g.:");
    console.log("  pnpm scan:try ./label-front.jpg ./label-nutrition.jpg");
    return;
  }
  if (paths.length > 3) throw new Error(`scan:try takes at most 3 images, got ${paths.length}`);

  const images: EngineImage[] = paths.map((path) => ({ mime: mimeFor(path), data: new Uint8Array(readFileSync(path)) }));

  const deadline = Date.now() + 50_000;
  const result = await extract(images, { model: "fast", signal: new AbortController().signal, deadline });

  console.log("\n--- extraction ---");
  console.log(JSON.stringify(result.data, null, 2));
  console.log("\n--- usage ---");
  console.log(result.usage);
  console.log(`\nmodelId: ${result.modelId}`);
  console.log(`costMicros: ${result.costMicros} (≈ $${(result.costMicros / 1_000_000).toFixed(6)})`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
