import { Bone, SkeletonCard, SkeletonPage, SkeletonRow } from "@/components/ui/skeleton";

/**
 * Today: greeting, headline, the calorie card, three macro tiles, then the four meals. On a wide
 * content area the page has a 300 px rail beside the day (the week and recent scans), so this does too.
 */
export default function TodayLoading() {
  return (
    <div className="@container">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 md:gap-6 @min-[840px]:grid-cols-[minmax(0,1fr)_300px] @min-[840px]:items-start">
        <SkeletonPage>
          <div className="flex items-center gap-3">
            <Bone className="size-11 shrink-0" />
            <div className="flex flex-1 flex-col gap-2">
              <Bone className="h-3.5 w-24" />
              <Bone className="h-3 w-20" />
            </div>
            <Bone className="size-11 shrink-0" />
          </div>
          <div className="flex flex-col gap-2.5">
            <Bone className="h-8 w-64 max-w-full rounded-[10px]" />
            <Bone className="h-8 w-44 rounded-[10px]" />
          </div>
          <SkeletonCard className="flex items-center justify-between gap-4 rounded-[30px] p-5">
            <div className="flex flex-col gap-3">
              <Bone className="h-3 w-16" />
              <Bone className="h-11 w-36 rounded-[12px]" />
              <Bone className="h-3 w-28" />
            </div>
            <Bone className="size-[104px] shrink-0" />
          </SkeletonCard>
          <div className="grid grid-cols-3 gap-2.5">
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} className="flex flex-col gap-3 p-3.5">
                <Bone className="h-3.5 w-14" />
                <Bone className="h-1.5 w-full" />
                <Bone className="h-3.5 w-16" />
              </SkeletonCard>
            ))}
          </div>
          <div className="grid gap-3.5 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <SkeletonCard key={i}>
                <SkeletonRow trailing="size-11" />
              </SkeletonCard>
            ))}
          </div>
        </SkeletonPage>
        <div aria-hidden="true" className="hidden flex-col gap-5 @min-[840px]:flex">
          <SkeletonCard className="flex flex-col gap-4">
            <Bone className="h-4 w-24" />
            <Bone className="h-[120px] w-full rounded-[14px]" />
          </SkeletonCard>
          <SkeletonCard className="flex flex-col gap-4">
            <Bone className="h-4 w-28" />
            <SkeletonRow trailing={null} />
            <SkeletonRow trailing={null} />
          </SkeletonCard>
        </div>
      </div>
    </div>
  );
}
