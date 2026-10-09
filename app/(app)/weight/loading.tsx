import { Bone, SkeletonCard, SkeletonPage, SkeletonTopBar } from "@/components/ui/skeleton";

/** Weight: the current weight with its trend, the log button, then recent entries. */
export default function WeightLoading() {
  return (
    <SkeletonPage className="mx-auto w-full max-w-[720px]">
      <SkeletonTopBar />
      <SkeletonCard className="flex flex-col gap-5">
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-3">
            <Bone className="h-3 w-16" />
            <Bone className="h-10 w-24 rounded-[10px]" />
          </div>
          <div className="flex flex-col items-end gap-2">
            <Bone className="h-3 w-32" />
            <Bone className="h-3 w-20" />
          </div>
        </div>
        <Bone className="h-[150px] w-full rounded-[14px]" />
      </SkeletonCard>
      <Bone className="h-14 w-full" />
      <SkeletonCard className="flex flex-col py-2">
        <Bone className="my-3 h-4 w-28" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 border-line py-[15px] not-first:border-t">
            <Bone className="h-3.5 w-20" />
            <Bone className="ml-auto h-3.5 w-12" />
            <Bone className="size-5" />
          </div>
        ))}
      </SkeletonCard>
    </SkeletonPage>
  );
}
