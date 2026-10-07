import { requireUser } from "@/lib/session";
import { listScans } from "@/lib/scans/service";
import { ScanList } from "@/components/history/scan-list";

export default async function HistoryPage() {
  const { userId, profile } = await requireUser();
  const now = new Date();
  const first = await listScans(userId, {}, now.getTime());
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
      <h1 className="m-0 text-[30px] font-[650] leading-[1.05] tracking-[-0.04em] text-ink md:text-[40px]">History</h1>
      <ScanList initialPage={first} tz={profile.timezone} now={now.toISOString()} />
    </div>
  );
}
