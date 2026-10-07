export type CreditsState = "ok" | "low" | "empty";
export function creditsState(credits: number): CreditsState {
  if (credits <= 0) return "empty";
  return credits <= 3 ? "low" : "ok";
}
