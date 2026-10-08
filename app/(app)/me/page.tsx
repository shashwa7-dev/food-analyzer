import { requireUser } from "@/lib/session";
import { getBalance } from "@/lib/credits/ledger";
import { allows } from "@/lib/credits/plans";
import { initialsOf } from "@/lib/initials";
import { resetDayLabel } from "@/lib/credits/display";
import { countVisibleScans } from "@/lib/scans/service";
import { CreditStrip } from "@/components/credits/credit-strip";
import { SettingsList } from "@/components/me/settings-list";
import { AccountFooter } from "@/components/me/account-footer";
import { ExportRow } from "@/components/me/export-row";
import { ScansUpsell } from "@/components/pro/scans-upsell";
import { TargetsNotice } from "@/components/today/targets-notice";
import { effectiveOverrides, showTargetsNotice } from "@/lib/profile/effective-targets";

const PLAN_LABEL = { basic: "Basic", pro: "Pro" } as const;

/**
 * Me (spec §6.13, mock "Me (simplified)"): who you are, scans left, six settings, Export data, sign out. One
 * column, centred at 560 px on desktop.
 */
export default async function MePage() {
  const { userId, profile, name, email } = await requireUser();
  const [balance, historyCount] = await Promise.all([getBalance(userId), countVisibleScans(userId)]);
  const resetsLabel = resetDayLabel(balance.periodResetsAt, profile.timezone);

  return (
    <div className="mx-auto grid w-full max-w-[560px] gap-[18px] md:gap-6 md:pt-1.5">
      <h1 className="sr-only">Me</h1>
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft font-bold text-on-brand-soft" aria-hidden>
          {initialsOf(name ?? "You")}
        </span>
        <div className="min-w-0 leading-[1.3]">
          <p className="m-0 truncate text-[17px] font-bold text-ink">{name || "You"}</p>
          <p className="m-0 truncate text-[13.5px] text-subtle">{email}</p>
        </div>
      </div>
      <CreditStrip credits={balance.credits} allowance={balance.allowance} planLabel={PLAN_LABEL[profile.plan]} resetsLabel={resetsLabel} />
      <ScansUpsell />
      {showTargetsNotice(profile) && <TargetsNotice />}
      {/* A locked plan's sheet shows the goal's presets (effective targets); stored overrides stay untouched. */}
      <SettingsList
        values={{ goal: profile.goal, diet: profile.diet, allergies: profile.allergies, targets: effectiveOverrides(profile), country: profile.country, customTargets: allows(profile.plan, "customTargets"), fitness: { weeklyWorkoutGoal: profile.weeklyWorkoutGoal, goalWeightKg: profile.goalWeightKg, heightCm: profile.heightCm } }}
        historyCount={historyCount}
      />
      <ExportRow />
      <AccountFooter />
    </div>
  );
}
