import { Bone, SkeletonCard, SkeletonPage, SkeletonTitle } from "@/components/ui/skeleton";

const BARS = ["h-[62%]", "h-[38%]", "h-[18%]", "h-[46%]", "h-[66%]", "h-[36%]", "h-[32%]"];

/** Progress: three stat tiles, the calories chart, then the macro split. */
export default function ProgressLoading() {
  return (
    <SkeletonPage>
      <SkeletonTitle withSwitch />
      <div className="grid grid-cols-3 gap-2.5">
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i} className="flex flex-col gap-3 p-3.5">
            <Bone className="size-4" />
            <Bone className="h-5 w-14 rounded-[8px]" />
            <Bone className="h-3 w-16" />
          </SkeletonCard>
        ))}
      </div>
      <SkeletonCard className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <Bone className="h-4 w-24" />
          <Bone className="h-3 w-40" />
        </div>
        <div className="flex h-[150px] items-end justify-between gap-3 px-3">
          {BARS.map((h, i) => <Bone key={i} className={`w-4 rounded-[6px] ${h}`} />)}
        </div>
      </SkeletonCard>
      <SkeletonCard className="flex flex-col gap-5">
        <Bone className="h-4 w-28" />
        <div className="flex items-center gap-5">
          <Bone className="size-[104px] shrink-0" />
          <div className="flex flex-1 flex-col gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <Bone className="h-3.5 w-20" />
                <Bone className="h-3.5 w-8" />
              </div>
            ))}
          </div>
        </div>
      </SkeletonCard>
    </SkeletonPage>
  );
}
