import { requireApiUser } from "@/lib/session";
import { json, serverError } from "@/lib/http";
import { getProfile } from "@/lib/profile/service";
import { effectiveTargets } from "@/lib/profile/effective-targets";
import { getBalance } from "@/lib/credits/ledger";

export async function GET(req: Request) {
  try {
    const userId = await requireApiUser(req);
    if (userId instanceof Response) return userId;
    const prof = await getProfile(userId);
    const { credits, allowance, periodResetsAt } = await getBalance(userId);
    return json({
      profile: {
        country: prof.country,
        timezone: prof.timezone,
        diet: prof.diet,
        allergies: prof.allergies,
        goal: prof.goal,
        targets: effectiveTargets(prof),
        onboarded: !!prof.onboardedAt,
        plan: prof.plan,
        credits,
        allowance,
        periodResetsAt,
      },
    });
  } catch {
    return serverError();
  }
}
