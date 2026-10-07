import Link from "next/link";
import { ChartColumn, Plus } from "lucide-react";
import type { Meal } from "@/lib/nutrition/types";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";

/** Fewer than 2 logged days in the range (spec §6.12): one card, no charts. */
export function ProgressEmpty({ meal, range }: { meal: Meal; range: "week" | "month" }) {
  return (
    <section aria-label="No trends yet" className="grid justify-items-center gap-3 rounded-[24px] bg-surface px-5 py-8 text-center shadow-card md:col-span-2 md:py-12">
      <IconTile tone="brand" size="lg"><ChartColumn /></IconTile>
      <h2 className="m-0 text-balance text-[19px] font-[650] tracking-[-0.02em] text-ink">Log a couple of days to see your trends</h2>
      <p className="m-0 max-w-[34ch] text-balance text-[14px] text-subtle">
        Your calories, macros and nutrient balance for the {range} show up here once two days have food logged.
      </p>
      <Button render={<Link href={`/foods?meal=${meal}`} />} nativeButton={false} shape="pill" size="xl" className="mt-1">
        <Plus aria-hidden />
        Log food
      </Button>
    </section>
  );
}
