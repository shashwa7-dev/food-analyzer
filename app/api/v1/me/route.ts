import { requireApiUser } from "@/lib/session";
import { json } from "@/lib/http";
import { getProfile } from "@/lib/profile/service";
import { targetsFor } from "@/lib/nutrition/targets";

export async function GET(req: Request) {
  const userId = await requireApiUser(req);
  if (userId instanceof Response) return userId;
  const prof = await getProfile(userId);
  return json({
    profile: {
      country: prof.country,
      timezone: prof.timezone,
      diet: prof.diet,
      allergies: prof.allergies,
      goal: prof.goal,
      targets: targetsFor(prof.goal, prof.targets),
      onboarded: !!prof.onboardedAt,
      plan: prof.plan,
      credits: prof.credits,
    },
  });
}
