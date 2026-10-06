export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

export function apiError(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export const notFound = () => apiError(404, "NOT_FOUND", "We couldn't find that.");
export const unauthorized = () => apiError(401, "UNAUTHORIZED", "Please sign in again.");
export const invalid = (message = "Some details are missing or invalid.") => apiError(400, "INVALID_INPUT", message);
export const serverError = () => apiError(500, "SERVER_ERROR", "Something went wrong. Try again.");

// Only trust a well-formed ISO alpha-2 country header.
export function countryFrom(h: Headers): string | undefined {
  const c = h.get("x-vercel-ip-country");
  return c && /^[A-Z]{2}$/.test(c) ? c : undefined;
}
