import { Bone, SkeletonCard, SkeletonPage, SkeletonTitle } from "@/components/ui/skeleton";

const BARS = ["h-[62%]", "h-[38%]", "h-[18%]", "h-[46%]", "h-[66%]", "h-[36%]", "h-[32%]"];

/** Progress: the stat tiles, the calories chart, then the macro split (two cards side by side from 900 px). */
export default function ProgressLoading() {
  return (
    <SkeletonPage className="md:grid md:grid-cols-2 md:gap-6">
      <SkeletonTitle withSwitch className="md:col-span-2" />
      <div className="grid grid-cols-3 gap-2.5 md:col-span-2 md:grid-cols-4">
        {/* Three tiles on a phone, four from 900 px. */}
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} className={i === 3 ? "hidden flex-col gap-3 p-3.5 md:flex" : "flex flex-col gap-3 p-3.5"}>
            <Bone className="size-4" />
            <Bone className="h-5 w-14 rounded-[8px]" />
            <Bone className="h-3 w-16" />
          </SkeletonCard>
        ))}
      </div>
      <SkeletonCard className="flex flex-col gap-5 md:col-span-2">
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
      <SkeletonCard className="hidden flex-col gap-5 md:flex">
        <Bone className="h-4 w-32" />
        <Bone className="h-[104px] w-full rounded-[14px]" />
      </SkeletonCard>
    </SkeletonPage>
  );
}
