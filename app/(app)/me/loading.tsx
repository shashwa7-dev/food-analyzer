import { Bone, SkeletonCard, SkeletonPage } from "@/components/ui/skeleton";

/** Me: who you are, the AI scans card, then the settings list. */
export default function MeLoading() {
  return (
    <SkeletonPage>
      <div className="flex items-center gap-3 pt-1">
        <Bone className="size-12 shrink-0" />
        <div className="flex flex-col gap-2">
          <Bone className="h-4 w-32" />
          <Bone className="h-3 w-40" />
        </div>
      </div>
      <SkeletonCard className="flex flex-col gap-3">
        <Bone className="h-3.5 w-36" />
        <Bone className="h-1.5 w-4/5" />
        <Bone className="h-3 w-28" />
      </SkeletonCard>
      <SkeletonCard className="flex flex-col py-1">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center gap-3 border-line py-[15px] not-first:border-t">
            <Bone className="size-5 shrink-0" />
            <Bone className="h-3.5 w-24" />
            <Bone className="ml-auto h-3.5 w-20" />
          </div>
        ))}
      </SkeletonCard>
    </SkeletonPage>
  );
}
