import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getBalance } from "@/lib/credits/ledger";
import { SettingsForm } from "@/components/me/settings-form";

const PLAN_LABEL = { basic: "Basic", pro: "Pro" } as const;

export default async function MePage() {
  const { userId, profile } = await requireUser();
  const balance = await getBalance(userId);
  return (
    <div className="flex flex-col gap-4">
      <header>
        <div className="text-sm text-subtle">Signed in with Google</div>
        <h1 className="title text-[30px]">Me</h1>
      </header>
      <Link href="/me/credits" className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4">
        <div>
          <div className="text-sm text-subtle">Plan</div>
          <div className="title mt-1 text-lg">
            {PLAN_LABEL[profile.plan]} · {balance.credits} / {balance.allowance} AI scans left
          </div>
        </div>
        <ChevronRight className="size-5 shrink-0 text-subtle" aria-hidden />
      </Link>
      <SettingsForm
        initial={{
          goal: profile.goal,
          diet: profile.diet,
          allergies: profile.allergies,
          targets: profile.targets ?? null,
          country: profile.country,
        }}
      />
    </div>
  );
}
