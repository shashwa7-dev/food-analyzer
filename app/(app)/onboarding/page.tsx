import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { allows } from "@/lib/credits/plans";
import { effectiveOverrides } from "@/lib/profile/effective-targets";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export const metadata = { title: "Get started" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ redo?: string }> }) {
  const { profile } = await requireUser();
  const redo = (await searchParams).redo === "1";
  if (profile.onboardedAt && !redo) redirect("/today");
  return (
    <OnboardingFlow
      initial={{
        goal: profile.goal,
        diet: profile.diet,
        allergies: profile.allergies,
        // A locked plan sees (and keeps) the goal's presets; its stored overrides stay untouched.
        targets: effectiveOverrides(profile),
      }}
      customTargets={allows(profile.plan, "customTargets")}
      redo={redo}
    />
  );
}
