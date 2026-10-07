import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireUser } from "@/lib/session";
import { getBalance } from "@/lib/credits/ledger";
import { resetDayLabel } from "@/lib/credits/display";
import { countVisibleScans } from "@/lib/scans/service";
import { AppNav } from "@/components/app-nav";
import { NavTracker } from "@/components/nav/nav-tracker";
import { ScanShortcut } from "@/components/nav/scan-shortcut";
import { TimezoneSync } from "@/components/timezone-sync";

const PLAN_LABEL = { basic: "Basic", pro: "Pro" } as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId, profile, name } = await requireUser();
  const path = (await headers()).get("x-pathname") ?? "";
  if (!profile.onboardedAt && !path.startsWith("/onboarding")) redirect("/onboarding");
  const [balance, historyCount] = await Promise.all([getBalance(userId), countVisibleScans(userId)]);
  const resetsLabel = resetDayLabel(balance.periodResetsAt, profile.timezone);
  return (
    // Onboarding (data-onboarding) has no nav, so it drops the sidebar column.
    <div className="bg-wash min-h-dvh md:grid md:grid-cols-[252px_minmax(0,1fr)] md:has-[[data-onboarding]]:block">
      <AppNav
        credits={balance.credits}
        allowance={balance.allowance}
        resetsLabel={resetsLabel}
        planLabel={PLAN_LABEL[profile.plan]}
        name={name ?? "You"}
        historyCount={historyCount}
      />
      <main className="mx-auto w-full max-w-[720px] px-4 pb-[110px] pt-4 md:max-w-[1100px] md:px-8 md:py-7">
        {children}
      </main>
      <ScanShortcut />
      <NavTracker />
      <TimezoneSync current={profile.timezone} />
    </div>
  );
}
