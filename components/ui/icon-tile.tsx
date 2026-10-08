import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type IconTileTone = "neutral" | "brand" | "good" | "bad" | "protein";
export type IconTileSize = "sm" | "md" | "lg";

const SIZE: Record<IconTileSize, string> = {
  sm: "size-10 rounded-[12px] [&_svg]:size-5",
  md: "size-11 rounded-[14px] [&_svg]:size-5",
  lg: "size-12 rounded-[15px] [&_svg]:size-6",
};

const TONE: Record<IconTileTone, string> = {
  neutral: "bg-sunken text-subtle",
  brand: "bg-brand-soft text-brand-deep",
  good: "bg-grade-a/15 text-grade-a",
  bad: "bg-grade-e/12 text-grade-e",
  // mock-c1 `.ftile.wk`: workouts and activities.
  protein: "bg-protein/14 text-protein",
};

export function IconTile({
  tone = "neutral",
  size = "sm",
  className,
  children,
}: {
  tone?: IconTileTone;
  size?: IconTileSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cn("grid shrink-0 place-items-center", SIZE[size], TONE[tone], className)} aria-hidden="true">
      {children}
    </span>
  );
}
