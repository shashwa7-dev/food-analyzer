import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { allows } from "@/lib/credits/plans";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

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
        targets: profile.targets ?? null,
      }}
      customTargets={allows(profile.plan, "customTargets")}
      redo={redo}
    />
  );
}
