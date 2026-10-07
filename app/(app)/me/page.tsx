import { requireUser } from "@/lib/session";
import { getBalance } from "@/lib/credits/ledger";
import { initialsOf } from "@/lib/initials";
import { dayMonth } from "@/lib/progress/copy";
import { CreditStrip } from "@/components/credits/credit-strip";
import { SettingsList } from "@/components/me/settings-list";
import { AccountFooter } from "@/components/me/account-footer";

const PLAN_LABEL = { basic: "Basic", pro: "Pro" } as const;

/**
 * Me (spec §6.13, mock "Me (simplified)"): who you are, scans left, four settings, sign out. One
 * column, centred at 560 px on desktop.
 */
export default async function MePage() {
  const { userId, profile, name, email } = await requireUser();
  const balance = await getBalance(userId);
  // The allowance resets at 00:00 UTC on the 1st, so the reset day is read in UTC.
  const resetsLabel = dayMonth(balance.periodResetsAt.toISOString().slice(0, 10));

  return (
    <div className="mx-auto grid w-full max-w-[560px] gap-[18px] md:pt-1.5">
      <h1 className="m-0 text-[30px] font-[650] leading-[1.05] tracking-[-0.04em] text-ink">Me</h1>
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft font-bold text-brand-deep" aria-hidden>
          {initialsOf(name ?? "You")}
        </span>
        <div className="min-w-0 leading-[1.3]">
          <p className="m-0 truncate text-[17px] font-bold text-ink">{name || "You"}</p>
          <p className="m-0 truncate text-[13.5px] text-subtle">{email}</p>
        </div>
      </div>
      <CreditStrip credits={balance.credits} allowance={balance.allowance} planLabel={PLAN_LABEL[profile.plan]} resetsLabel={resetsLabel} />
      <SettingsList
        values={{ goal: profile.goal, diet: profile.diet, allergies: profile.allergies, targets: profile.targets ?? null, country: profile.country }}
      />
      <AccountFooter />
    </div>
  );
}
