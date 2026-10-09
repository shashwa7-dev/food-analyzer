export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    /** The form field the server flagged, when it named one. */
    public field?: string,
  ) {
    super(message);
  }
}

/** Fired on window after any successful write through api(): data behind server-rendered pages has changed. */
export const DATA_CHANGED_EVENT = "santul:data-changed";

function announceWrite(init?: RequestInit) {
  const method = (init?.method ?? "GET").toUpperCase();
  if (method === "GET" || method === "HEAD" || typeof window === "undefined") return;
  window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
}

/**
 * JSON over fetch for the app's own API. A successful write is announced (DATA_CHANGED_EVENT), which
 * components/nav/data-refresher.tsx turns into a router refresh: pages are kept in the browser for a
 * minute (next.config.ts staleTimes), and a write is what makes those copies out of date.
 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  if (res.status === 204) {
    announceWrite(init);
    return undefined as T;
  }
  const body = (await res.json().catch(() => null)) as { error?: { code: string; message: string; field?: string } } | null;
  if (!res.ok) throw new ApiError(res.status, body?.error?.code ?? "SERVER_ERROR", body?.error?.message ?? "Something went wrong. Try again.", body?.error?.field);
  announceWrite(init);
  return body as T;
}
