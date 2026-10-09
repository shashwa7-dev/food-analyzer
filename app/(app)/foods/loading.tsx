import { Bone, SkeletonPage, SkeletonRow, SkeletonTopBar } from "@/components/ui/skeleton";

/** Food search: the bar, the search field, then a list of foods. */
export default function FoodsLoading() {
  return (
    <SkeletonPage>
      <SkeletonTopBar />
      <Bone className="h-12 w-full" />
      <Bone className="h-3.5 w-20" />
      <div className="flex flex-col gap-5">
        {[0, 1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} trailing="size-10" />)}
      </div>
    </SkeletonPage>
  );
}
