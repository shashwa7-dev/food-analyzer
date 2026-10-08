"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Flame, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveSheet, SheetTitle } from "@/components/ui/responsive-sheet";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { AmountStepper } from "@/components/food/amount-stepper";
import { ACTIVITY_ICONS } from "@/components/fitness/activity-icons";
import { api } from "@/lib/api-client";
import { todayIn } from "@/lib/dates";
import { ACTIVITIES } from "@/lib/fitness/catalogue";
import { kcalBurned } from "@/lib/fitness/burn";
import { INTENSITIES, type Activity, type Intensity, type WorkoutDetail } from "@/lib/fitness/types";

const MIN = 5;
const MAX = 600;
const STEP = 5;
const INTENSITY_LABEL: Record<Intensity, string> = { easy: "Easy", moderate: "Moderate", hard: "Hard" };

function ActivitySheetBody({ activity, timezone }: { activity: Activity; timezone: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [minutes, setMinutes] = useState(30);
  const [intensity, setIntensity] = useState<Intensity>("moderate");
  const title = ACTIVITIES[activity].title;
  const Icon = ACTIVITY_ICONS[activity];
  // The real weight lives on the server; this preview always uses the 70 kg estimate, hence "~".
  const preview = kcalBurned({ kind: activity, intensity, minutes, weightKg: null });

  const log = useMutation({
    mutationFn: () =>
      api<{ workout: WorkoutDetail }>("/api/v1/workouts", {
        method: "POST",
        body: JSON.stringify({ kind: "activity", date: todayIn(timezone), activity, intensity, durationMin: minutes }),
      }),
    onSuccess: ({ workout: w }) => {
      toast.success(`${title} logged · ${w.kcalEstimated ? "~" : ""}${w.kcalBurned} kcal`);
      void qc.invalidateQueries({ queryKey: ["fitness"] });
      router.push("/today");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn’t log that. Try again."),
  });

  return (
    <>
      <div className="flex items-center gap-3">
        <IconTile tone="protein" size="lg"><Icon /></IconTile>
        <div className="min-w-0 flex-1 leading-tight">
          <SheetTitle className="block truncate text-[18px] font-semibold tracking-[-0.02em] text-ink">{title}</SheetTitle>
          <span className="block truncate text-[13px] text-subtle">Other activity</span>
        </div>
      </div>
      <AmountStepper
        amount={minutes}
        sub="minutes"
        onStep={(dir) => setMinutes((m) => Math.min(MAX, Math.max(MIN, m + dir * STEP)))}
        canDecrease={minutes > MIN}
        canIncrease={minutes < MAX}
      />
      <div className="flex gap-1.5" role="group" aria-label="Intensity">
        {INTENSITIES.map((i) => (
          <button
            key={i}
            type="button"
            aria-pressed={i === intensity}
            onClick={() => setIntensity(i)}
            className="min-h-11 min-w-0 flex-1 truncate rounded-[13px] border border-line bg-surface px-3 text-[13px] font-semibold whitespace-nowrap text-subtle transition-colors aria-pressed:border-transparent aria-pressed:bg-action aria-pressed:text-action-ink"
          >
            {INTENSITY_LABEL[i]}
          </button>
        ))}
      </div>
      <p className="num m-0 flex items-center gap-[5px] px-1 text-[13.5px] font-semibold whitespace-nowrap text-ink [&_svg]:size-4" aria-live="polite">
        <Flame className="text-grade-d" aria-hidden />~{preview.kcal} kcal burned
      </p>
      <Button type="button" shape="pill" size="xl" className="h-[54px] w-full" disabled={log.isPending} onClick={() => log.mutate()}>
        {log.isPending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Check aria-hidden />}
        {log.isPending ? "Logging…" : `Log ${title.toLowerCase()}`}
      </Button>
    </>
  );
}

/**
 * The "Other activity" sheet (spec §C screen 4): minutes (±5, 5–600), intensity, a live burn estimate
 * and "Log {activity}", which posts an activity workout for today and returns to Today. The caller
 * keeps `activity` set while it closes, and bumps `session` per open so the form starts fresh.
 */
export function ActivitySheet({ activity, session, timezone, open, onOpenChange }: {
  activity: Activity | null; session: number; timezone: string; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  return (
    <ResponsiveSheet open={open && activity !== null} onOpenChange={onOpenChange}>
      {activity && <ActivitySheetBody key={`${activity}:${session}`} activity={activity} timezone={timezone} />}
    </ResponsiveSheet>
  );
}
