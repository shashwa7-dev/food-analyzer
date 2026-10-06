import { requireUser } from "@/lib/session";
import { SettingsForm } from "@/components/me/settings-form";

export default async function MePage() {
  const { profile } = await requireUser();
  return (
    <div className="flex flex-col gap-4">
      <header>
        <div className="text-sm text-subtle">Signed in with Google</div>
        <h1 className="title text-[30px]">Me</h1>
      </header>
      <section className="rounded-lg border border-line bg-surface p-4">
        <div className="text-sm text-subtle">Plan</div>
        <div className="title mt-1 text-lg">Basic · AI scans arrive soon</div>
      </section>
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
