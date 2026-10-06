import Link from "next/link";
import { requireUser } from "@/lib/session";
import { myFoods } from "@/lib/foods/service";
import { GradeBadge } from "@/components/grade-badge";
import { FoodsPageSearch } from "@/components/add-food/foods-page-search";

export default async function FoodsPage() {
  const { userId } = await requireUser();
  const mine = await myFoods(userId);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="title text-[30px] md:text-[34px]">Foods</h1>
        <Link href="/foods/new" className="inline-flex min-h-11 items-center rounded-md border border-line px-3.5 text-sm font-semibold">
          Create
        </Link>
      </div>
      <FoodsPageSearch />
      {mine.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="section-title">My foods</h2>
          <ul className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
            {mine.map((f) => (
              <li key={f.id} className="border-b border-line last:border-b-0">
                <Link href={`/foods/${f.id}`} className="flex min-h-14 items-center gap-3.5 px-3.5 py-3">
                  <GradeBadge grade={f.grade} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {f.name}
                      {f.brand && <span className="font-normal text-subtle"> · {f.brand}</span>}
                    </span>
                    <span className="text-sm text-subtle">
                      {f.defaultPortion.label}
                      {f.defaultPortion.kcal !== null && (
                        <>
                          {" "}
                          · <span className="num">{f.defaultPortion.kcal}</span> kcal
                        </>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-sm text-subtle">
        Data: INDB, USDA FoodData Central, Open Food Facts.{" "}
        <Link href="/about/data" className="underline">
          Learn more
        </Link>
      </p>
    </div>
  );
}
