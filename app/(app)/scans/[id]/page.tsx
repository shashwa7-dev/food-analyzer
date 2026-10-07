import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getScan } from "@/lib/scans/service";
import { getBalance } from "@/lib/credits/ledger";
import { getFoodForUser } from "@/lib/foods/service";
import { DateSchema, defaultMealIn, todayIn } from "@/lib/dates";
import { MEALS, type Meal } from "@/lib/nutrition/types";
import { RunningScan } from "@/components/scan/scan-result";
import { FailedScan, ScanResultView, type ScanParams } from "@/components/scan/scan-result-view";

export default async function ScanResultPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<ScanParams> }) {
  const { userId, profile } = await requireUser();
  const [view, raw] = await Promise.all([getScan(userId, (await params).id), searchParams]);
  if (!view) notFound();

  const sp: ScanParams = {
    meal: (MEALS as readonly string[]).includes(raw.meal ?? "") ? raw.meal : undefined,
    date: raw.date && DateSchema.safeParse(raw.date).success ? raw.date : undefined,
  };

  if (view.status === "queued" || view.status === "processing") return <RunningScan scanId={view.id} />;
  if (view.status === "failed" || !view.result) return <FailedScan view={view} sp={sp} />;

  const r = view.result;
  const today = todayIn(profile.timezone);
  const date = sp.date ?? today;
  // The INDB sodium caveat applies when the numbers (or a plate item's) came from an INDB food.
  const linkedIds = [...new Set([r.foodId, ...(r.items ?? []).map((it) => it.foodId)].filter((id): id is string => !!id))];
  const [balance, linked] = await Promise.all([
    getBalance(userId),
    Promise.all(linkedIds.map((id) => getFoodForUser(userId, id))),
  ]);
  return (
    <ScanResultView
      view={{ ...view, result: r }} credits={balance.credits} fromIndb={linked.some((f) => f?.source === "indb")}
      date={date} meal={(sp.meal as Meal | undefined) ?? defaultMealIn(profile.timezone)} isToday={date === today}
      hasAllergies={profile.allergies.length > 0} diet={profile.diet} sp={sp}
    />
  );
}
