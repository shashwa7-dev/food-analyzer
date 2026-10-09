import { Activity as Pulse, Bike, Flower2, Footprints, Volleyball, type LucideIcon } from "lucide-react";
import type { Activity } from "@/lib/fitness/types";

/** The icon for each "Other activity" (mock-c1 Fitness: walk, run, bike, yoga, ball). */
export const ACTIVITY_ICONS: Record<Activity, LucideIcon> = {
  walk: Footprints,
  run: Pulse,
  cycling: Bike,
  yoga: Flower2,
  sport: Volleyball,
};
