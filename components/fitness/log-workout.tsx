"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Dumbbell, Plus } from "lucide-react";
import { BackButton } from "@/components/nav/back-button";
import { IconTile } from "@/components/ui/icon-tile";
import { ActivitySheet } from "@/components/fitness/activity-sheet";
import { ACTIVITY_ICONS } from "@/components/fitness/activity-icons";
import { ResumeBanner } from "@/components/fitness/resume-banner";
import { ACTIVITIES, PRESETS } from "@/lib/fitness/catalogue";
import { ACTIVITY_KEYS, PRESET_KEYS, type Activity } from "@/lib/fitness/types";

const CARD = "rounded-[20px] bg-surface shadow-card";

/**
 * /workouts/new (spec §C screen 1): the resume banner, the five gym presets (each starts a session)
 * plus "Empty session", and the five other activities, which open the activity sheet.
 */
export function LogWorkout({ userId, timezone }: { userId: string; timezone: string }) {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);

  return (
    <div data-no-phone-nav className="mx-auto flex w-full max-w-[720px] flex-col gap-3">
      <div className="flex items-center justify-between gap-2.5">
        <BackButton fallback="/workouts" />
        <h1 className="m-0 min-w-0 truncate text-[17px] font-semibold whitespace-nowrap text-ink">Log workout</h1>
        <span className="size-11 shrink-0" aria-hidden />
      </div>

      <ResumeBanner userId={userId} />

      <div className="flex items-center justify-between gap-2 px-0.5 pt-1">
        <h2 className="m-0 truncate text-[15px] font-semibold text-ink">Gym session</h2>
        <Link
          href="/workouts/session?preset=empty"
          className="-mr-2 inline-flex min-h-11 shrink-0 items-center gap-[3px] rounded-full px-2 text-[13px] font-semibold whitespace-nowrap text-brand-deep [&_svg]:size-[15px]"
        >
          <Plus aria-hidden />
          Empty session
        </Link>
      </div>
      <ul className={`m-0 grid list-none p-0 ${CARD}`}>
        {PRESET_KEYS.map((key) => {
          const p = PRESETS[key];
          return (
            <li key={key} className="border-line not-first:border-t">
              <Link href={`/workouts/session?preset=${key}`} className="flex min-h-[60px] items-center gap-3 px-3.5 py-2 text-ink">
                <IconTile tone="brand"><Dumbbell /></IconTile>
                <span className="min-w-0 flex-1 leading-tight">
                  <b className="block truncate text-[15px] font-semibold">{p.title}</b>
                  <span className="block truncate text-[13px] text-subtle">{p.muscles}</span>
                </span>
                <span className="num shrink-0 text-[12px] whitespace-nowrap text-subtle">{p.exercises.length} exercises</span>
                <ChevronRight className="size-[18px] shrink-0 text-subtle" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>

      <h2 className="m-0 truncate px-0.5 pt-1 text-[15px] font-semibold text-ink">Other activity</h2>
      <div className="grid grid-cols-5 gap-1.5">
        {ACTIVITY_KEYS.map((key) => {
          const Icon = ACTIVITY_ICONS[key];
          return (
            <button
              key={key}
              type="button"
              aria-haspopup="dialog"
              onClick={() => {
                setActivity(key);
                setSession((n) => n + 1);
                setOpen(true);
              }}
              className={`grid min-h-11 min-w-0 justify-items-center gap-1 px-0.5 py-2.5 text-[11.5px] font-semibold text-ink transition-colors hover:bg-sunken ${CARD} rounded-[14px]`}
            >
              <Icon className="size-[22px] text-protein" aria-hidden />
              <span className="block max-w-full truncate whitespace-nowrap">{ACTIVITIES[key].title}</span>
            </button>
          );
        })}
      </div>

      <ActivitySheet activity={activity} session={session} timezone={timezone} open={open} onOpenChange={setOpen} />
    </div>
  );
}
