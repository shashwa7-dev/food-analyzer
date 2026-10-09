import { requireUser } from "@/lib/session";
import { todayIn } from "@/lib/dates";
import { getWeightHistory } from "@/lib/fitness/weight";
import { WeightLog } from "@/components/fitness/weight/weight-log";

export const metadata = { title: "Weight" };

/** Weight (spec §C screen 7): the latest weight and its 30-day change, the trend with the goal, the log. */
export default async function WeightPage() {
  const { userId, profile } = await requireUser();
  const history = await getWeightHistory(userId, { days: 90 });
  return <WeightLog history={history} today={todayIn(profile.timezone)} />;
}
