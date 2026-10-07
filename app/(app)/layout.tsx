import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireUser } from "@/lib/session";
import { getBalance } from "@/lib/credits/ledger";
import { AppNav } from "@/components/app-nav";
import { TimezoneSync } from "@/components/timezone-sync";

const PLAN_LABEL = { basic: "Basic", pro: "Pro" } as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId, profile } = await requireUser();
  const path = (await headers()).get("x-pathname") ?? "";
  if (!profile.onboardedAt && !path.startsWith("/onboarding")) redirect("/onboarding");
  const balance = await getBalance(userId);
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[232px_minmax(0,1fr)]">
      <AppNav credits={balance.credits} allowance={balance.allowance} planLabel={PLAN_LABEL[profile.plan]} />
      <main className="mx-auto w-full max-w-[720px] px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-4 md:px-8 md:pb-12 md:pt-7">
        {children}
      </main>
      <TimezoneSync current={profile.timezone} />
    </div>
  );
}
