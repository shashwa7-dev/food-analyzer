import { after } from "next/server";
import { requireApiUser } from "@/lib/session";
import { apiError, invalid, json, serverError } from "@/lib/http";
import { InvalidError } from "@/lib/errors";
import { realDeps } from "@/lib/scans/deps";
import { SCAN_MESSAGES } from "@/lib/scans/messages";
import { createScan, listScans, ListScansSchema, SCAN_DEADLINE_MS } from "@/lib/scans/service";
import { parseScanForm, readScanRequest } from "@/lib/scans/upload";

// The background model call runs in after(), within this budget (engine deadline is 50 s).
export const maxDuration = 60;

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,128}$/;

export async function POST(req: Request) {
  const deadline = Date.now() + SCAN_DEADLINE_MS; // one budget per scan, from the start of the request
  try {
    const userId = await requireApiUser(req);
    if (userId instanceof Response) return userId;

    const key = req.headers.get("idempotency-key");
    if (key !== null && !IDEMPOTENCY_KEY.test(key)) return apiError(400, "INVALID_INPUT", SCAN_MESSAGES.INVALID_INPUT);

    const read = await readScanRequest(req);
    if ("error" in read) return apiError(read.status, read.error, SCAN_MESSAGES[read.error]);
    const parsed = await parseScanForm(read.form);
    if ("error" in parsed) return apiError(parsed.error === "TOO_LARGE" ? 413 : 400, parsed.error, SCAN_MESSAGES[parsed.error]);

    const r = await createScan(userId, { ...parsed, clientRequestId: key, deadline }, realDeps(userId), after);
    return json(r.body, { status: r.status });
  } catch (e) {
    console.error("POST /api/v1/scans failed", e);
    return serverError();
  }
}

export async function GET(req: Request) {
  try {
    const userId = await requireApiUser(req);
    if (userId instanceof Response) return userId;
    const sp = new URL(req.url).searchParams;
    const q = ListScansSchema.safeParse({
      cursor: sp.get("cursor") || undefined, grade: sp.get("grade") || undefined, q: sp.get("q")?.trim() || undefined,
    });
    if (!q.success) return invalid();
    return json(await listScans(userId, q.data));
  } catch (e) {
    if (e instanceof InvalidError) return invalid();
    return serverError();
  }
}
