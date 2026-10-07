import { requireUser } from "@/lib/session";
import { listScans } from "@/lib/scans/service";
import { ScanList } from "@/components/history/scan-list";

export default async function HistoryPage() {
  const { userId } = await requireUser();
  const first = await listScans(userId, {});
  return (
    <div className="flex flex-col gap-5">
      <h1 className="title text-[30px] md:text-[34px]">History</h1>
      <ScanList initialPage={first} />
    </div>
  );
}
