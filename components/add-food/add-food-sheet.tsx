"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { FoodSearch } from "@/components/add-food/food-search";
import { QuickAddForm } from "@/components/add-food/quick-add-form";
import { AddToMeal } from "@/components/food/add-to-meal";
import { api } from "@/lib/api-client";
import type { FoodHit } from "@/lib/foods/types";
import type { Meal, Nutrients, Portion } from "@/lib/nutrition/types";

type DetailFood = { id: string; name: string; per100: Nutrients; portions: Portion[]; defaultPortion: number; basis: "per_100g" | "per_100ml" };

const TABS = ["search", "scan", "quick"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { search: "Search", scan: "Scan", quick: "Quick add" };

function AddFoodSheetBody({ meal, date, onOpenChange }: { meal: Meal; date: string; onOpenChange: (open: boolean) => void }) {
  const [tab, setTab] = useState<Tab>("search");
  const [picked, setPicked] = useState<FoodHit | null>(null);
  const detail = useQuery({
    queryKey: ["foods", picked?.id],
    queryFn: () => api<{ food: DetailFood }>(`/api/v1/foods/${picked!.id}`),
    enabled: picked !== null,
  });

  if (picked) {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setPicked(null)}
          className="flex min-h-10 items-center gap-1.5 self-start text-sm font-semibold text-subtle"
        >
          <ChevronLeft className="size-4" aria-hidden /> Back
        </button>
        {detail.isLoading && <p className="text-sm text-subtle">Loading…</p>}
        {detail.isError && <p className="text-sm text-bad">Couldn’t load that food. Try again.</p>}
        {detail.data && <AddToMeal food={detail.data.food} date={date} defaultMeal={meal} onDone={() => onOpenChange(false)} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="mb-3.5 flex gap-1 rounded-md bg-sunken p-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className="min-h-10 flex-1 rounded-[8px] text-sm font-semibold text-subtle aria-selected:bg-surface aria-selected:text-ink aria-selected:shadow-card"
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>
      {tab === "search" && <FoodSearch autoFocus onPick={setPicked} />}
      {tab === "quick" && <QuickAddForm date={date} meal={meal} onDone={() => onOpenChange(false)} />}
      {tab === "scan" && <p className="py-10 text-center text-sm text-subtle">Coming soon.</p>}
    </div>
  );
}

export function AddFoodSheet({ meal, date, open, onOpenChange }: { meal: Meal; date: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const isDesktop = useMediaQuery("(min-width: 900px)");

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogTitle className="section-title capitalize">Add to {meal}</DialogTitle>
          <AddFoodSheetBody meal={meal} date={date} onOpenChange={onOpenChange} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="section-title text-left capitalize">Add to {meal}</DrawerTitle>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-4 pt-2 pb-[calc(16px+env(safe-area-inset-bottom))]">
          <AddFoodSheetBody meal={meal} date={date} onOpenChange={onOpenChange} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
