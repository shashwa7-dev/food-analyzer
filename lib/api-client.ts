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

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => null)) as { error?: { code: string; message: string; field?: string } } | null;
  if (!res.ok) throw new ApiError(res.status, body?.error?.code ?? "SERVER_ERROR", body?.error?.message ?? "Something went wrong. Try again.", body?.error?.field);
  return body as T;
}
