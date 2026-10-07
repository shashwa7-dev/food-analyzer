// Default model ids for the two scan tiers. Pure constants (no imports) so this module can be
// used from both lib/env.ts (zod schema defaults) and lib/engine/model.ts (reading env directly
// — see the comment on readModelConfig there) and scripts/scan-try.ts, without those three ever
// drifting out of sync with each other.
export const DEFAULT_MODEL_FAST = "gemini-3.5-flash-lite";
export const DEFAULT_MODEL_STRONG = "gemini-3.5-flash";
