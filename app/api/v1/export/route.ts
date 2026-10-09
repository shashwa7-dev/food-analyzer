import { z } from "zod";
import { requireApiUser } from "@/lib/session";
import { apiError, invalid, serverError } from "@/lib/http";
import { getProfile } from "@/lib/profile/service";
import { allows } from "@/lib/credits/plans";
import { todayIn } from "@/lib/dates";
import { EXPORT_KINDS, exportCsv } from "@/lib/export/service";

const Query = z.object({ what: z.enum(EXPORT_KINDS) });

/**
 * GET /api/v1/export?what=diary|scans|workouts|weight → the signed-in user's data as a CSV download
 * (columns in lib/export/service.ts). Pro-only once PRO_GATES_ENFORCED is on (403 PRO_REQUIRED).
 */
export async function GET(req: Request) {
  try {
    const userId = await requireApiUser(req);
    if (userId instanceof Response) return userId;
    const parsed = Query.safeParse({ what: new URL(req.url).searchParams.get("what") });
    if (!parsed.success) return invalid("Pick diary, scans, workouts or weight.");
    const profile = await getProfile(userId);
    if (!allows(profile.plan, "dataExport")) return apiError(403, "PRO_REQUIRED", "Exporting your data is part of Pro.");
    const what = parsed.data.what;
    const body = exportCsv(userId, what, profile.timezone);
    return new Response(body, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="santul-${what}-${todayIn(profile.timezone)}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch {
    return serverError();
  }
}
