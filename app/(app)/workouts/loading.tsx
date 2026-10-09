import { Bone, SkeletonCard, SkeletonPage, SkeletonRow, SkeletonTitle } from "@/components/ui/skeleton";

/** Workouts: the weekly goal and week strip, what's up next, then the month card. */
export default function WorkoutsLoading() {
  return (
    <SkeletonPage>
      <SkeletonTitle withSwitch />
      {/* One column on a phone (goal and week first); from 900 px they move to a side column, as on the page. */}
      <div className="grid gap-3.5 md:grid-cols-[minmax(0,1fr)_300px] md:items-start md:gap-6">
        <div className="flex flex-col gap-3.5 md:order-2 md:gap-5">
          <SkeletonCard className="flex items-center justify-between gap-4 p-5">
            <div className="flex flex-col gap-3">
              <Bone className="h-3 w-24" />
              <Bone className="h-9 w-28 rounded-[10px]" />
              <Bone className="h-3 w-36" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[0, 1, 2, 3, 4].map((i) => <Bone key={i} className="size-4" />)}
            </div>
          </SkeletonCard>
          <SkeletonCard className="grid grid-cols-7 justify-items-center gap-2">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2.5">
                <Bone className="h-2.5 w-3" />
                <Bone className="size-7" />
              </div>
            ))}
          </SkeletonCard>
        </div>
        <div className="flex flex-col gap-3.5 md:gap-5">
          <SkeletonCard className="flex flex-col gap-4">
            <SkeletonRow trailing={null} />
            <div className="flex gap-2.5">
              <Bone className="h-11 w-32" />
              <Bone className="h-11 w-20" />
            </div>
          </SkeletonCard>
          <SkeletonCard className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Bone className="h-4 w-24" />
              <Bone className="h-9 w-36" />
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 28 }, (_, i) => <Bone key={i} className="h-7 rounded-[8px]" />)}
            </div>
          </SkeletonCard>
        </div>
      </div>
    </SkeletonPage>
  );
}
