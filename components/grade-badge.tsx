import { cn } from "@/lib/utils";
const BG: Record<string, string> = { A: "bg-grade-a text-white", B: "bg-grade-b text-white", C: "bg-grade-c text-[#2a2100]", D: "bg-grade-d text-white", E: "bg-grade-e text-white" };

type BadgeSize = "sm" | "base" | "md" | "lg";
const DIM: Record<BadgeSize, string> = {
  sm: "size-[26px] text-[13px] rounded-[8px]",
  base: "size-[30px] text-[15px] rounded-[10px]",
  md: "size-11 text-xl rounded-[14px]",
  lg: "size-[72px] text-3xl rounded-[22px]",
};

export function GradeBadge({ grade, size = "base" }: { grade: string | null; size?: BadgeSize }) {
  const dim = DIM[size];
  if (!grade) return <span className={cn("grid shrink-0 place-items-center bg-sunken font-bold text-subtle", dim)} aria-label="Not graded">–</span>;
  return <span className={cn("grid shrink-0 place-items-center font-bold", BG[grade], dim)} aria-label={`Grade ${grade}`}>{grade}</span>;
}

export function GradeStrip({ grade }: { grade: string | null }) {
  return (
    <div className="flex items-center gap-[3px]" role="img" aria-label={grade ? `Grade ${grade}` : "Not graded"}>
      {["A", "B", "C", "D", "E"].map((g) => (
        <span key={g} className={cn("grid place-items-center font-bold", BG[g], g === grade ? "h-14 w-[50px] rounded-sm text-[28px] ring-[1.5px] ring-ink ring-offset-[3px] ring-offset-surface" : "h-10 w-[34px] rounded-sm text-[17px] opacity-40")}>{g}</span>
      ))}
    </div>
  );
}
