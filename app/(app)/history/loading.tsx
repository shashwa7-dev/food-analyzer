import { Bone, SkeletonCard, SkeletonPage, SkeletonRow, SkeletonTitle } from "@/components/ui/skeleton";

/** History: search, the grade filters, then the scans. */
export default function HistoryLoading() {
  return (
    <SkeletonPage>
      <SkeletonTitle />
      <Bone className="h-12 w-full" />
      <div className="flex gap-2 overflow-hidden">
        {["w-12", "w-24", "w-24", "w-24"].map((w, i) => <Bone key={i} className={`h-10 shrink-0 ${w}`} />)}
      </div>
      {[0, 1, 2, 3, 4].map((i) => (
        <SkeletonCard key={i}>
          <SkeletonRow />
        </SkeletonCard>
      ))}
    </SkeletonPage>
  );
}
