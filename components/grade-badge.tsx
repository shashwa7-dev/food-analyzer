import { GRADE_UNAVAILABLE } from "@/lib/nutrition/grade-unavailable";
import { cn } from "@/lib/utils";
/** Each grade's fill with a readable text colour on it (C is light, so its text is dark). */
export const GRADE_FILL: Record<string, string> = { A: "bg-grade-a text-white", B: "bg-grade-b text-white", C: "bg-grade-c text-[#2a2100]", D: "bg-grade-d text-white", E: "bg-grade-e text-white" };

type BadgeSize = "sm" | "base" | "md" | "lg";
const DIM: Record<BadgeSize, string> = {
  sm: "size-[26px] text-[13px] rounded-[8px]",
  base: "size-[30px] text-[15px] rounded-[10px]",
  md: "size-11 text-xl rounded-[14px]",
  lg: "size-[72px] text-3xl rounded-[22px]",
};

export function GradeBadge({ grade, size = "base" }: { grade: string | null; size?: BadgeSize }) {
  const dim = DIM[size];
  // A provisional grade (lib/nutrition/grade-unavailable.ts): neutral, no letter.
  // A dashed outline keeps it visible on a sunken surface (the unavailable hero is one).
  if (grade === GRADE_UNAVAILABLE) return <span className={cn("grid shrink-0 place-items-center border-[1.5px] border-dashed border-subtle/45 bg-sunken font-bold text-subtle", dim)} aria-label="Grade unavailable">?</span>;
  if (!grade) return <span className={cn("grid shrink-0 place-items-center bg-sunken font-bold text-subtle", dim)} aria-label="Not graded">–</span>;
  return <span className={cn("grid shrink-0 place-items-center font-bold", GRADE_FILL[grade], dim)} aria-label={`Grade ${grade}`}>{grade}</span>;
}
