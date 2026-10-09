import type { DayType } from "@/lib/fitness/insights";

/**
 * Day-type look (global constraints: day-type colours), used wherever a day type shows as a dot or a
 * bar (the calendar, the "how often you train each day type" breakdown). `dot` and `bar` are the same
 * token at different opacities; a legend using these always sits under the calendar.
 */
export const DAY_TYPE_META: Record<DayType, { label: string; dot: string; bar: string }> = {
  push: { label: "Push", dot: "bg-brand", bar: "bg-brand" },
  pull: { label: "Pull", dot: "bg-protein", bar: "bg-protein" },
  legs: { label: "Legs", dot: "bg-warn", bar: "bg-warn" },
  back: { label: "Back", dot: "bg-carbs", bar: "bg-carbs" },
  shoulders: { label: "Shoulders", dot: "bg-fat", bar: "bg-fat" },
  custom: { label: "Custom", dot: "bg-brand-deep/60", bar: "bg-brand-deep/60" },
  activity: { label: "Activity", dot: "bg-subtle/70", bar: "bg-subtle/70" },
};
