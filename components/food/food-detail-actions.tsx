"use client";
// Client parts of /foods/[id]: the top bar (Back, and for your own food an overflow with Edit and
// Delete) and the sticky "Add to {Meal}", which opens the add sheet for this food.
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import type { FoodIconKey } from "@/lib/foods/icon";
import type { Flag, Meal } from "@/lib/nutrition/types";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { OverflowMenu } from "@/components/ui/overflow-menu";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { BackButton } from "@/components/nav/back-button";
import { AddToMeal, type LoggableFood } from "@/components/food/add-to-meal";
import { FlagNotes, FoodSheetHeader } from "@/components/food/sheet-parts";
import { MEAL_META } from "@/components/food/meal-meta";
import { StickyActionBar } from "@/components/food/result-parts";

export const DELETE_FOOD_COPY = "It leaves search and My foods. Past diary entries keep their values.";

/** Back (to where you came from, else food search), the title, and for a custom food you own: Edit and Delete. */
export function FoodTopBar({ foodId, owner }: { foodId: string; owner: boolean }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const del = useMutation({
    mutationFn: async () => {
      try {
        await api(`/api/v1/foods/${foodId}`, { method: "DELETE" });
      } catch (e) {
        // Already gone (a second tap, or deleted in another tab) is the outcome the user wanted.
        if (!(e instanceof ApiError && e.status === 404)) throw e;
      }
    },
    onSuccess: async () => {
      toast.success("Food deleted.");
      await qc.invalidateQueries({ queryKey: ["foods"] });
      router.replace("/foods");
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't delete that. Try again."),
  });

  return (
    <div className="flex items-center justify-between gap-2.5">
      <BackButton fallback="/foods" />
      <p className="m-0 min-w-0 truncate text-[17px] font-semibold whitespace-nowrap text-ink">{owner ? "My food" : "Food"}</p>
      {owner ? (
        <>
          <OverflowMenu
            items={[
              { label: "Edit food", icon: <Pencil />, href: `/foods/new?edit=${foodId}` },
              { label: "Delete food", icon: <Trash2 />, tone: "danger", onSelect: () => setConfirm(true) },
            ]}
          />
          <ConfirmDialog
            open={confirm}
            onOpenChange={setConfirm}
            icon={<Trash2 />}
            title="Delete this food?"
            body={DELETE_FOOD_COPY}
            confirmLabel="Delete"
            pendingLabel="Deleting…"
            pending={del.isPending}
            onConfirm={() => del.mutate()}
          />
        </>
      ) : (
        <span className="size-11 shrink-0" aria-hidden />
      )}
    </div>
  );
}

/**
 * The food page's "Add to a meal" card for wide screens (mock-c1 "Food detail" C, ≥ 900 px): meal
 * tiles, the amount with live calories and "Add to {Meal}" in place, then `footer` (the better pick).
 * Phones get the sticky bar and the sheet instead (FoodAddBar).
 */
export function FoodAddPanel({ foodId, food, date, defaultMeal, footer }: {
  foodId: string; food: LoggableFood; date: string; defaultMeal: Meal; footer?: ReactNode;
}) {
  return (
    <section className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-[24px] bg-surface p-[18px] shadow-card" aria-labelledby="add-panel-title">
      <h2 id="add-panel-title" className="section-title m-0">Add to a meal</h2>
      <AddToMeal food={food} target={{ kind: "food", foodId }} date={date} defaultMeal={defaultMeal} layout="panel" />
      {footer}
    </section>
  );
}

/** The sticky "Add to {Meal}" and its add sheet (amount, unit, meal, live macros, personal flags); phones only. */
export function FoodAddBar({ foodId, food, iconKey, grade, subtitle, flags, note, date, defaultMeal }: {
  foodId: string; food: LoggableFood; iconKey: FoodIconKey; grade: string | null; subtitle: string;
  flags: Flag[]; note: string | null; date: string; defaultMeal: Meal;
}) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  return (
    <>
      <StickyActionBar fullWidth className="md:hidden">
        <div className="mx-auto grid max-w-[560px]">
          <Button
            type="button"
            shape="pill"
            size="xl"
            className="h-[54px] w-full min-w-0 px-4"
            onClick={() => {
              setSession((n) => n + 1);
              setOpen(true);
            }}
          >
            <Plus aria-hidden />
            <span className="truncate">Add to {MEAL_META[defaultMeal].label}</span>
          </Button>
        </div>
      </StickyActionBar>
      <ResponsiveSheet open={open} onOpenChange={setOpen}>
        <FoodSheetHeader iconKey={iconKey} name={food.name} subtitle={subtitle} grade={grade} />
        <AddToMeal
          key={session}
          food={food}
          target={{ kind: "food", foodId }}
          date={date}
          defaultMeal={defaultMeal}
          notes={<FlagNotes flags={flags} note={note} />}
          onDone={() => setOpen(false)}
        />
      </ResponsiveSheet>
    </>
  );
}
